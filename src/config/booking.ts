export const RESTAURANT_TZ = "Europe/Moscow";

/** One entry per weekday, Monday first. `null` = closed. A close time <= open time means "after midnight". */
export type DaySchedule = { open: string; close: string } | null;
export type Schedule = DaySchedule[];

export const defaultSchedule: Schedule = [
  { open: "12:00", close: "23:00" }, // Пн
  { open: "12:00", close: "23:00" },
  { open: "12:00", close: "23:00" },
  { open: "12:00", close: "23:00" },
  { open: "12:00", close: "01:00" }, // Пт
  { open: "12:00", close: "01:00" },
  { open: "12:00", close: "22:00" }, // Вс
];

export type BookingRules = {
  schedule: Schedule;
  durationMinutes: number; // how long a table is held
  slotIntervalMinutes: number; // start times are offered every N minutes
  seatingCapacity: number; // total seats available at the same moment
  maxConcurrent: number; // total parties (tables) at the same moment
  maxPartySize: number;
  minNoticeMinutes: number;
  horizonDays: number; // how far ahead guests can book
  autoConfirm: boolean; // false: every booking starts as "pending" and a human confirms it
};

export const defaultRules: BookingRules = {
  schedule: defaultSchedule,
  durationMinutes: 120,
  slotIntervalMinutes: 60,
  seatingCapacity: 40,
  maxConcurrent: 12,
  maxPartySize: 12,
  minNoticeMinutes: 60,
  horizonDays: 60,
  autoConfirm: false,
};

export const dayNames = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;
