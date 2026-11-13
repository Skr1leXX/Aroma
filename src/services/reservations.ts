// Booking engine. All availability decisions are made here, on the server, inside a transaction
// that holds a per-date advisory lock, so two concurrent requests cannot both take the last seats.
import { and, count, eq, gte, inArray, ne, sql } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import { defaultRules, type BookingRules } from "@/config/booking";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { getTxDb } from "@/db/transactional";
import { checkSlot, isValidDate, localNow, ruleMessages, slotsFor, toMinutes, type RuleError } from "@/lib/booking";
import { uuid, type ReservationInput } from "@/lib/validations";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyPg = PgDatabase<any, typeof schema>;

const { reservations: R, restaurantSettings: S } = schema;
const ACTIVE = ["pending", "confirmed"] as const; // statuses that hold seats
const RATE_LIMIT_PER_HOUR = 5;

export async function loadRules(database: AnyPg = db): Promise<BookingRules> {
  const [row] = await database.select().from(S).where(eq(S.id, 1));
  if (!row) return defaultRules;
  return {
    schedule: row.schedule,
    durationMinutes: row.reservationDurationMinutes,
    slotIntervalMinutes: row.slotIntervalMinutes,
    seatingCapacity: row.seatingCapacity,
    maxConcurrent: row.maxConcurrentReservations,
    maxPartySize: row.maxPartySize,
    minNoticeMinutes: row.minNoticeMinutes,
    horizonDays: row.bookingHorizonDays,
    autoConfirm: row.autoConfirm,
  };
}

type Booked = { startMinute: number | null; durationMinutes: number; guests: number };

/** Parties and seats already held at any moment inside [start, start + duration). */
function load(booked: Booked[], start: number, duration: number) {
  const overlapping = booked.filter((b) => {
    const s = b.startMinute ?? 0;
    return s < start + duration && start < s + b.durationMinutes;
  });
  return { parties: overlapping.length, seats: overlapping.reduce((n, b) => n + b.guests, 0) };
}

const hasRoom = (booked: Booked[], start: number, guests: number, rules: BookingRules) => {
  const { parties, seats } = load(booked, start, rules.durationMinutes);
  return parties < rules.maxConcurrent && seats + guests <= rules.seatingCapacity;
};

const activeOn = (database: AnyPg, date: string) =>
  database
    .select({ startMinute: R.startMinute, durationMinutes: R.durationMinutes, guests: R.guests })
    .from(R)
    .where(and(eq(R.reservationDate, date), inArray(R.status, [...ACTIVE])));

export type Availability =
  | { ok: true; slots: { time: string; available: boolean }[] }
  | { ok: false; code: RuleError; message: string };

/** What the booking form offers. Advisory only: createReservation() re-checks everything. */
export async function getAvailability(date: string, guests: number, database: AnyPg = db, now = new Date()): Promise<Availability> {
  const rules = await loadRules(database);
  if (!isValidDate(date)) return { ok: false, code: "invalid_date", message: ruleMessages.invalid_date };
  if (guests > rules.maxPartySize) return { ok: false, code: "party_size", message: ruleMessages.party_size };
  const slots = slotsFor(date, rules);
  const first = checkSlot(date, slots[0] ?? "00:00", guests, rules, now);
  if (!slots.length) return { ok: false, code: "closed", message: ruleMessages.closed };
  if (date < localNow(now).date) return { ok: false, code: "past", message: ruleMessages.past };
  if (first === "horizon") return { ok: false, code: "horizon", message: ruleMessages.horizon };
  const booked = await activeOn(database, date);
  return {
    ok: true,
    slots: slots.map((time) => ({
      time,
      available: checkSlot(date, time, guests, rules, now) === null && hasRoom(booked, toMinutes(time), guests, rules),
    })),
  };
}

export type CreateResult =
  | { ok: true; id: string; status: "pending" | "confirmed"; replay: boolean }
  | { ok: false; code: RuleError | "unavailable" | "duplicate" | "rate_limited"; message: string };

const fail = (code: Extract<CreateResult, { ok: false }>["code"]): CreateResult => ({ ok: false, code, message: ruleMessages[code] });

export async function createReservation(
  input: Pick<ReservationInput, "name" | "phone" | "email" | "date" | "time" | "guests" | "comment" | "idempotencyKey">,
  ctx: { ipHash?: string | null; userId?: string | null } = {},
  database: AnyPg = getTxDb(),
  now = new Date(),
): Promise<CreateResult> {
  const rules = await loadRules(database);
  const problem = checkSlot(input.date, input.time, input.guests, rules, now);
  if (problem) return fail(problem);

  if (ctx.ipHash) {
    const since = new Date(now.getTime() - 3600_000);
    const [{ n }] = await database.select({ n: count() }).from(R).where(and(eq(R.ipHash, ctx.ipHash), gte(R.createdAt, since)));
    if (n >= RATE_LIMIT_PER_HOUR) return fail("rate_limited");
  }

  return database.transaction(async (tx) => {
    // Serialises all bookings for this date. Released automatically at commit/rollback.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`booking:${input.date}`}))`);

    const [replay] = await tx.select({ id: R.id, status: R.status }).from(R).where(eq(R.idempotencyKey, input.idempotencyKey));
    if (replay) return { ok: true, id: replay.id, status: replay.status === "confirmed" ? "confirmed" : "pending", replay: true } as const;

    // Statements after the lock see every booking committed before the lock was granted (READ COMMITTED).
    const booked = await activeOn(tx as unknown as AnyPg, input.date);
    const start = toMinutes(input.time);
    if (!hasRoom(booked, start, input.guests, rules)) return fail("unavailable");

    const [dup] = await tx
      .select({ id: R.id })
      .from(R)
      .where(
        and(
          eq(R.reservationDate, input.date),
          eq(R.startMinute, start),
          inArray(R.status, [...ACTIVE]),
          sql`(lower(${R.email}) = ${input.email.toLowerCase()} or regexp_replace(${R.phone}, '\\D', '', 'g') = ${input.phone.replace(/\D/g, "")})`,
        ),
      );
    if (dup) return fail("duplicate");

    const status = rules.autoConfirm ? "confirmed" : "pending";
    const [row] = await tx
      .insert(R)
      .values({
        userId: ctx.userId ?? null,
        name: input.name,
        phone: input.phone,
        email: input.email,
        reservationDate: input.date,
        reservationTime: input.time,
        guests: input.guests,
        comment: input.comment ?? null,
        durationMinutes: rules.durationMinutes,
        status,
        idempotencyKey: input.idempotencyKey,
        ipHash: ctx.ipHash ?? null,
      })
      .returning({ id: R.id });
    return { ok: true, id: row.id, status, replay: false } as const;
  });
}

/** Minimal public view for the confirmation page. The UUID is the unguessable access token. */
export async function getReservationSummary(id: string) {
  if (!uuid.safeParse(id).success) return null;
  const [r] = await db
    .select({ name: R.name, date: R.reservationDate, time: R.reservationTime, guests: R.guests, status: R.status })
    .from(R)
    .where(eq(R.id, id));
  return r ? { ...r, name: r.name.split(" ")[0] } : null;
}

export type MoveResult = { ok: true; from: { date: string; time: string } } | { ok: false; code: RuleError | "unavailable" | "not_found" | "inactive"; message: string };

/**
 * Admin: change the date/time of a pending or confirmed booking. Same hours and capacity rules and the same
 * per-date lock as a new booking (the booking itself is excluded from the load), but no minimum-notice rule.
 */
export async function moveReservation(id: string, date: string, time: string, database: AnyPg = getTxDb(), now = new Date()): Promise<MoveResult> {
  const rules = await loadRules(database);
  return database.transaction(async (tx): Promise<MoveResult> => {
    const [row] = await tx.select().from(R).where(eq(R.id, id));
    if (!row) return { ok: false, code: "not_found", message: "Бронь не найдена" };
    if (!ACTIVE.includes(row.status as (typeof ACTIVE)[number])) return { ok: false, code: "inactive", message: "Можно переносить только активные брони" };

    const problem = checkSlot(date, time, row.guests, { ...rules, minNoticeMinutes: 0, maxPartySize: Math.max(rules.maxPartySize, row.guests) }, now);
    if (problem) return { ok: false, code: problem, message: ruleMessages[problem] };

    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`booking:${date}`}))`);
    const booked = await tx
      .select({ startMinute: R.startMinute, durationMinutes: R.durationMinutes, guests: R.guests })
      .from(R)
      .where(and(eq(R.reservationDate, date), inArray(R.status, [...ACTIVE]), ne(R.id, id)));
    if (!hasRoom(booked, toMinutes(time), row.guests, { ...rules, durationMinutes: row.durationMinutes })) {
      return { ok: false, code: "unavailable", message: ruleMessages.unavailable };
    }
    await tx.update(R).set({ reservationDate: date, reservationTime: time }).where(eq(R.id, id));
    return { ok: true, from: { date: row.reservationDate, time: row.reservationTime } };
  });
}
