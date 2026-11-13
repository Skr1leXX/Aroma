// Offline end-to-end check of schema + migrations + seed + Better Auth flows on an in-process
// Postgres (PGlite). It does NOT touch Neon or Cloudinary:  npm run verify:local
import { PGlite } from "@electric-sql/pglite";
import { count, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as s from "@/db/schema";
import { seed } from "@/db/seed";
import { createAuth, getUserRole } from "@/lib/auth";
import { addDays, dayIndex, formatHours, localNow, slotsFor } from "@/lib/booking";
import { contactSchema, reservationSchema } from "@/lib/validations";
import { createReservation, getAvailability, loadRules } from "@/services/reservations";

process.env.BETTER_AUTH_SECRET ??= "local-verification-secret-0123456789abcdef";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";

let failed = 0;
const check = (name: string, ok: boolean, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failed++;
};
const rejects = async (name: string, p: Promise<unknown>) => check(name, await p.then(() => false, () => true));

async function main() {
  const db = drizzle(new PGlite(), { schema: s });
  await migrate(db, { migrationsFolder: "./drizzle" });
  check("migrations applied", true);

  // seed (twice: must be idempotent)
  await seed(db);
  await seed(db);
  const n = async (t: Parameters<typeof db.select>[0] extends never ? never : typeof s.menuItems | typeof s.menuCategories | typeof s.reservations | typeof s.reviews | typeof s.menuItemImages) =>
    (await db.select({ c: count() }).from(t))[0].c;
  const [cats, items, imgs, bookings, revs] = await Promise.all([n(s.menuCategories), n(s.menuItems), n(s.menuItemImages), n(s.reservations), n(s.reviews)]);
  check("seed: >=5 categories", cats >= 5, String(cats));
  check("seed: >=20 dishes", items >= 20, String(items));
  check("seed: one image per dish, idempotent", imgs === items, `${imgs}/${items}`);
  check("seed: bookings and reviews", bookings >= 3 && revs >= 3, `${bookings}/${revs}`);

  // constraints
  const [cat] = await db.select().from(s.menuCategories).limit(1);
  const base = { categoryId: cat.id, name: "x", description: "y", slug: "t1" };
  await rejects("constraint: price must be > 0", db.insert(s.menuItems).values({ ...base, price: "0" }));
  await rejects("constraint: unique slug", db.insert(s.menuItems).values({ ...base, slug: "citrus-salad", price: "10" }));
  await rejects("constraint: guests 1..12", db.insert(s.reservations).values({ name: "a", phone: "1", email: "a@b.c", reservationDate: "2030-01-01", reservationTime: "19:00", guests: 13 }));
  await rejects("constraint: time format", db.insert(s.reservations).values({ name: "a", phone: "1", email: "a@b.c", reservationDate: "2030-01-01", reservationTime: "25:99", guests: 2 }));
  await rejects("constraint: rating 1..5", db.insert(s.reviews).values({ author: "a", rating: 6, text: "t" }));
  const [item] = await db.select().from(s.menuItems).limit(1);
  await rejects("constraint: single primary image per dish", db.insert(s.menuItemImages).values({ menuItemId: item.id, url: "u", isPrimary: true }));
  await rejects("constraint: category with dishes cannot be deleted", db.delete(s.menuCategories).where(eq(s.menuCategories.id, cat.id)));

  // booking engine ---------------------------------------------------------------------------
  const today = localNow().date;
  let day = addDays(today, 10);
  while (dayIndex(day) !== 2) day = addDays(day, 1); // a Wednesday, clear of seeded bookings
  const rules0 = await loadRules(db);
  check("slots: weekday 12:00..21:00", JSON.stringify(slotsFor(day, rules0)) === JSON.stringify(["12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00"]));
  check("slots: Friday runs past midnight (last start 23:00)", slotsFor(addDays(day, 2), rules0).at(-1) === "23:00");
  check("formatHours groups days", formatHours(rules0.schedule).map((h) => h.days).join(",") === "Пн–Чт,Пт–Сб,Вс");

  let seq = 0;
  const who = () => {
    seq++;
    return { name: "Тест Гость", phone: `+7 900 000 ${String(1000 + seq)}`, email: `t${seq}@example.com`, idempotencyKey: crypto.randomUUID() };
  };
  const book = (time: string, guests: number, over: Record<string, unknown> = {}, date = day, ctx = {}) =>
    createReservation({ ...who(), date, time, guests, ...over } as never, ctx, db);
  const code = async (p: ReturnType<typeof book>) => {
    const r = await p;
    return r.ok ? "ok" : r.code;
  };

  const first = await book("19:00", 2);
  check("booking is saved as pending", first.ok && first.status === "pending");
  const key = crypto.randomUUID();
  const a = await createReservation({ ...who(), date: day, time: "13:00", guests: 2, idempotencyKey: key }, {}, db);
  const b = await createReservation({ ...who(), date: day, time: "13:00", guests: 2, idempotencyKey: key }, {}, db);
  const keyed = (await db.select({ c: count() }).from(s.reservations).where(eq(s.reservations.idempotencyKey, key)))[0].c;
  check("double submit (same key) creates one booking", a.ok && b.ok && a.id === b.id && b.replay && keyed === 1);

  const dupe = who();
  await createReservation({ ...dupe, date: day, time: "14:00", guests: 2 }, {}, db);
  check("same contacts + same slot is rejected", (await code(book("14:00", 2, { email: dupe.email, phone: "+7 911 111 1111" }))) === "duplicate");

  check("past date rejected", (await code(book("19:00", 2, {}, addDays(today, -1)))) === "past");
  check("outside opening hours rejected", (await code(book("03:00", 2))) === "outside_hours");
  check("last start must leave full duration", (await code(book("22:00", 2))) === "outside_hours");
  check("party above limit rejected", (await code(book("19:00", 13))) === "party_size");
  check("beyond horizon rejected", (await code(book("19:00", 2, {}, addDays(today, 200)))) === "horizon");
  check("invalid calendar date rejected", (await code(book("19:00", 2, {}, "2026-02-31"))) === "invalid_date");
  check("sunday closes earlier (21:00 start rejected)", (await code(book("21:00", 2, {}, addDays(day, 4)))) === "outside_hours");

  // capacity: 10 seats, 2 parties at a time
  await db.update(s.restaurantSettings).set({ seatingCapacity: 10, maxConcurrentReservations: 2 });
  const day2 = addDays(day, 7);
  check("capacity: 6 seats ok", (await code(book("19:00", 6, {}, day2))) === "ok");
  check("capacity: 6 + 5 > 10 rejected", (await code(book("19:00", 5, {}, day2))) === "unavailable");
  check("capacity: overlapping start (20:00) counts too", (await code(book("20:00", 5, {}, day2))) === "unavailable");
  check("capacity: 6 + 4 = 10 ok", (await code(book("19:00", 4, {}, day2))) === "ok");
  check("capacity: party limit (2 at a time) blocks", (await code(book("19:00", 1, {}, day2))) === "unavailable");
  check("capacity: slot right after the booking ends is free", (await code(book("21:00", 6, {}, day2))) === "ok");
  const av = await getAvailability(day2, 2, db);
  check("availability: 19:00 full, 12:00 free", av.ok && av.slots.find((x) => x.time === "19:00")?.available === false && av.slots.find((x) => x.time === "12:00")?.available === true);
  check("availability: past day is refused", !(await getAvailability(addDays(today, -1), 2, db)).ok);

  // concurrency: 5 simultaneous requests for 4 seats each, room for exactly 2
  const day3 = addDays(day, 14);
  const racers = await Promise.all(Array.from({ length: 5 }, () => book("12:00", 4, {}, day3)));
  const wins = racers.filter((r) => r.ok).length;
  const seatsUsed = (await db.select({ g: s.reservations.guests }).from(s.reservations).where(eq(s.reservations.reservationDate, day3))).reduce((t, r) => t + r.g, 0);
  check("concurrent requests cannot exceed capacity", wins === 2 && seatsUsed <= 10, `${wins} accepted, ${seatsUsed} seats`);

  // rejected bookings release their seats
  const [victim] = await db.select({ id: s.reservations.id }).from(s.reservations).where(eq(s.reservations.reservationDate, day3)).limit(1);
  await db.update(s.reservations).set({ status: "rejected" }).where(eq(s.reservations.id, victim.id));
  check("rejected booking frees its seats", (await code(book("12:00", 4, {}, day3))) === "ok");

  // closed weekday, auto-confirm, rate limit
  await db.update(s.restaurantSettings).set({ schedule: rules0.schedule.map((d, i) => (i === 1 ? null : d)), seatingCapacity: 200, maxConcurrentReservations: 100 });
  check("closed weekday rejected", (await code(book("19:00", 2, {}, addDays(day, -1)))) === "closed");
  await db.update(s.restaurantSettings).set({ autoConfirm: true });
  const auto = await book("18:00", 2, {}, addDays(day, 21));
  check("autoConfirm=true confirms immediately", auto.ok && auto.status === "confirmed");
  await db.update(s.restaurantSettings).set({ autoConfirm: false });
  const limited: string[] = [];
  for (let i = 0; i < 6; i++) limited.push(await code(book("17:00", 2, {}, addDays(day, 28), { ipHash: "same-ip" })));
  check("rate limit: 6th booking from one IP is refused", limited.slice(0, 5).every((c) => c === "ok") && limited[5] === "rate_limited", limited.join(","));
  check("rate limit does not hit other IPs", (await code(book("17:00", 2, {}, addDays(day, 28), { ipHash: "other-ip" }))) === "ok");

  // validation layer
  check("zod: honeypot value passes validation (the action drops the request silently)", reservationSchema.safeParse({ ...who(), date: day, time: "19:00", guests: 2, website: "spam" }).data?.website === "spam");
  check("zod: bad phone and email", !reservationSchema.safeParse({ ...who(), phone: "abc", email: "nope", date: day, time: "19:00", guests: 2 }).success);
  check("zod: contact needs phone or email", !contactSchema.safeParse({ name: "Аня", message: "Здравствуйте, вопрос" }).success && contactSchema.safeParse({ name: "Аня", phone: "+7 900 123 45 67", message: "Здравствуйте, вопрос" }).success);
  await rejects("db: contact message without any contact is refused", db.insert(s.contactMessages).values({ name: "x", message: "hello world" }));

  // auth
  let resetUrl = "";
  const auth = createAuth(db, async (m) => void (resetUrl = m.text.match(/https?:\/\/\S+/)?.[0] ?? ""));
  const email = "guest@example.com";
  const up = await auth.api.signUpEmail({ body: { name: "Гость", email, password: "correct-horse-1" } });
  check("signup works", !!up.user.id);
  check("signup creates profile + customer role", (await getUserRole(up.user.id, db)) === "customer" && (await db.select().from(s.profiles).where(eq(s.profiles.userId, up.user.id))).length === 1);

  // privilege escalation attempt: extra field in the signup body must be ignored
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const evil = await auth.api.signUpEmail({ body: { name: "Evil", email: "evil@example.com", password: "correct-horse-1", role: "admin" } as any });
  check("signup cannot set role=admin", (await getUserRole(evil.user.id, db)) === "customer");

  await rejects("signup rejects short password", auth.api.signUpEmail({ body: { name: "S", email: "s@example.com", password: "short" } }));
  await rejects("signup rejects duplicate email", auth.api.signUpEmail({ body: { name: "G", email, password: "correct-horse-1" } }));
  await rejects("login rejects wrong password", auth.api.signInEmail({ body: { email, password: "wrong-password" } }));

  const login = await auth.api.signInEmail({ body: { email, password: "correct-horse-1" }, returnHeaders: true });
  const cookie = (login.headers.getSetCookie() ?? []).map((c) => c.split(";")[0]).join("; ");
  const withCookie = new Headers({ cookie });
  const sess = await auth.api.getSession({ headers: withCookie });
  check("login creates a session", sess?.user.email === email && cookie.length > 0);
  check("session count in DB", (await db.select({ c: count() }).from(s.sessions))[0].c >= 1);

  await auth.api.signOut({ headers: withCookie });
  check("logout invalidates the session", (await auth.api.getSession({ headers: withCookie })) === null);

  await auth.api.requestPasswordReset({ body: { email, redirectTo: "/reset-password" } });
  await new Promise((r) => setTimeout(r, 200));
  const token = resetUrl.match(/\/reset-password\/([^?]+)/)?.[1] ?? "";
  check("password reset link generated", token.length > 10, resetUrl.slice(0, 60));
  await auth.api.resetPassword({ body: { newPassword: "brand-new-pass-2", token } });
  await rejects("old password rejected after reset", auth.api.signInEmail({ body: { email, password: "correct-horse-1" } }));
  check("new password works after reset", !!(await auth.api.signInEmail({ body: { email, password: "brand-new-pass-2" } })).user);
  await rejects("reset token is single-use", auth.api.resetPassword({ body: { newPassword: "another-pass-3", token } }));

  // roles
  await db.update(s.userRoles).set({ role: "admin" }).where(eq(s.userRoles.userId, up.user.id));
  check("role lookup reflects admin", (await getUserRole(up.user.id, db)) === "admin");

  console.log(failed ? `\n${failed} check(s) FAILED` : "\nAll checks passed");
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
