// Pure booking rules (no I/O) so they can be unit-checked and reused by the UI and the server.
import { dayNames, RESTAURANT_TZ, type BookingRules, type Schedule } from "@/config/booking";

export type RuleError =
  | "invalid_date" | "closed" | "outside_hours" | "past" | "notice" | "horizon" | "party_size";

export const ruleMessages: Record<RuleError | "unavailable" | "duplicate" | "rate_limited", string> = {
  invalid_date: "Некорректная дата",
  closed: "В этот день ресторан закрыт",
  outside_hours: "Это время вне графика работы или слишком близко к закрытию",
  past: "Нельзя забронировать время в прошлом",
  notice: "Слишком поздно для онлайн-брони на это время — позвоните нам",
  horizon: "Бронирование на такую дату пока недоступно",
  party_size: "Для такой компании позвоните нам",
  unavailable: "На это время нет свободных мест. Выберите другое время",
  duplicate: "Заявка на это время с такими контактами уже есть",
  rate_limited: "Слишком много заявок. Попробуйте чуть позже или позвоните нам",
};

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
export const toHHMM = (min: number) =>
  `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** Current date (YYYY-MM-DD) and minutes since midnight in the restaurant's timezone. */
export function localNow(now = new Date(), tz = RESTAURANT_TZ) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(now)
      .map((x) => [x.type, x.value]),
  );
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

export const dayIndex = (date: string) => (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7; // 0 = Monday
export const isValidDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) && new Date(`${date}T00:00:00Z`).toISOString().startsWith(date);
export const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 864e5);

/** Start times offered for a date, ignoring current load. A table must be free for the full duration before closing. */
export function slotsFor(date: string, rules: BookingRules): string[] {
  const day = rules.schedule[dayIndex(date)];
  if (!day) return [];
  const open = toMinutes(day.open);
  let close = toMinutes(day.close);
  if (close <= open) close += 1440;
  const out: string[] = [];
  for (let t = open; t + rules.durationMinutes <= close; t += rules.slotIntervalMinutes) out.push(toHHMM(t));
  return out;
}

/** Everything about (date, time, guests) that does not depend on other bookings. */
export function checkSlot(date: string, time: string, guests: number, rules: BookingRules, now = new Date()): RuleError | null {
  if (!isValidDate(date)) return "invalid_date";
  if (guests < 1 || guests > rules.maxPartySize) return "party_size";
  const today = localNow(now);
  const ahead = daysBetween(today.date, date);
  if (ahead < 0) return "past";
  if (ahead > rules.horizonDays) return "horizon";
  if (!rules.schedule[dayIndex(date)]) return "closed";
  if (!slotsFor(date, rules).includes(time)) return "outside_hours";
  const minutesFromNow = ahead * 1440 + toMinutes(time) - today.minutes;
  if (minutesFromNow <= 0) return "past";
  if (minutesFromNow < rules.minNoticeMinutes) return "notice";
  return null;
}

/** Human-readable hours, grouping consecutive days with identical hours: "Пн–Чт: 12:00 – 23:00". */
export function formatHours(schedule: Schedule): { days: string; time: string }[] {
  const label = (d: Schedule[number]) => (d ? `${d.open} – ${d.close}` : "Закрыто");
  const groups: { from: number; to: number; time: string }[] = [];
  schedule.forEach((d, i) => {
    const last = groups[groups.length - 1];
    if (last && last.time === label(d)) last.to = i;
    else groups.push({ from: i, to: i, time: label(d) });
  });
  return groups.map((g) => ({ days: g.from === g.to ? dayNames[g.from] : `${dayNames[g.from]}–${dayNames[g.to]}`, time: g.time }));
}
