import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { addDays, dayIndex, localNow } from "../../src/lib/booking";
import { DATABASE_URL } from "./pg-server";

export const pool = new Pool({ connectionString: DATABASE_URL, max: 4 });
export const q = <T extends Record<string, unknown> = Record<string, unknown>>(text: string, params: unknown[] = []) =>
  pool.query<T>(text, params).then((r) => r.rows);

export const today = () => localNow().date;

/** First date at least `minAhead` days from now that falls on the given weekday (0 = Monday). */
export function nextWeekday(weekday: number, minAhead = 5) {
  let d = addDays(today(), minAhead);
  while (dayIndex(d) !== weekday) d = addDays(d, 1);
  return d;
}

let n = 0;
/** Unique contact details so duplicate / rate-limit rules never interfere between tests. */
export function guest(prefix = "e2e") {
  n++;
  const pad = (v: number, w: number) => String(v % 10 ** w).padStart(w, "0");
  return {
    name: `Тест ${prefix}`,
    email: `${prefix}-${Date.now().toString(36)}${n}@example.com`,
    phone: `+7 9${pad(n, 2)} ${pad(100 + n, 3)}-${pad(n * 7, 2)}-${pad(n * 13, 2)}`,
    key: randomUUID(),
  };
}

// 1x1 PNG
export const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
