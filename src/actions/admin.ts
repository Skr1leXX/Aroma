"use server";

// Thin layer: authorise (role read from the DB on every call) -> validate with zod -> call the service.
// Nothing here trusts the UI: hidden buttons are cosmetic, assertAdmin() is the gate.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { deleteImage } from "@/lib/cloudinary";
import { formatHours } from "@/lib/booking";
import { UserError } from "@/lib/errors";
import { assertAdmin, ForbiddenError } from "@/lib/session";
import {
  adminNoteSchema, categorySchema, menuItemSchema, rescheduleSchema, settingsSchema, uuid,
} from "@/lib/validations";
import * as admin from "@/services/admin";
import { moveReservation } from "@/services/reservations";
import type { ActionState } from "@/types";

type Result<T> = { ok: true; data: T } | { ok: false; message: string };

async function guard<T>(fn: (a: admin.Admin) => Promise<T>): Promise<Result<T>> {
  try {
    const a = await assertAdmin();
    const data = await fn({ id: a.id, email: a.email });
    revalidatePath("/", "layout");
    return { ok: true, data };
  } catch (e) {
    if (e instanceof UserError) return { ok: false, message: e.message };
    if (e instanceof ForbiddenError) return { ok: false, message: "Нет доступа" };
    if (e instanceof z.ZodError) return { ok: false, message: "Некорректные данные" };
    console.error("[admin action]", e);
    return { ok: false, message: "Не удалось выполнить операцию. Попробуйте ещё раз." };
  }
}

const strip = (r: Result<unknown>): { ok: boolean; message?: string } => (r.ok ? { ok: true } : { ok: false, message: r.message });
const fields = (form: FormData) => Object.fromEntries([...form].map(([k, v]) => [k, typeof v === "string" ? v : ""]));
const invalid = (e: z.ZodError): ActionState => ({ ok: false, message: "Проверьте поля формы", errors: e.flatten().fieldErrors as ActionState["errors"] });
const done = (r: Result<unknown>, message: string): ActionState => (r.ok ? { ok: true, message } : { ok: false, message: r.message });

/* ------------------------------------------------------------ reservations */

export async function setReservationStatus(id: string, status: string) {
  return strip(await guard((a) => admin.setReservationStatus(a, uuid.parse(id), z.enum(["confirmed", "rejected", "cancelled"]).parse(status))));
}

export async function rescheduleReservation(_: ActionState, form: FormData): Promise<ActionState> {
  const parsed = rescheduleSchema.safeParse(fields(form));
  const id = uuid.safeParse(form.get("id"));
  if (!parsed.success) return invalid(parsed.error);
  if (!id.success) return { ok: false, message: "Некорректные данные" };
  const res = await guard(async (a) => {
    const r = await moveReservation(id.data, parsed.data.date, parsed.data.time);
    if (!r.ok) throw new UserError(r.message);
    await admin.audit(db, a, "reservation.reschedule", "reservation", id.data, {
      date: [r.from.date, parsed.data.date], time: [r.from.time, parsed.data.time],
    });
  });
  return done(res, "Бронь перенесена");
}

export async function saveReservationNote(_: ActionState, form: FormData): Promise<ActionState> {
  const note = adminNoteSchema.safeParse(form.get("note") ?? "");
  const id = uuid.safeParse(form.get("id"));
  if (!note.success) return { ok: false, message: "Комментарий слишком длинный (до 1000 символов)" };
  if (!id.success) return { ok: false, message: "Некорректные данные" };
  return done(await guard((a) => admin.setReservationNote(a, id.data, note.data)), "Комментарий сохранён");
}

/* -------------------------------------------------------------------- menu */

export async function createMenuItem(_: ActionState, form: FormData): Promise<ActionState & { id?: string }> {
  const parsed = menuItemSchema.safeParse(fields(form));
  if (!parsed.success) return invalid(parsed.error);
  const res = await guard((a) => admin.createMenuItem(a, parsed.data));
  return res.ok ? { ok: true, message: "Блюдо создано", id: res.data } : { ok: false, message: res.message };
}

export async function updateMenuItem(_: ActionState, form: FormData): Promise<ActionState> {
  const parsed = menuItemSchema.safeParse(fields(form));
  const id = uuid.safeParse(form.get("id"));
  if (!parsed.success) return invalid(parsed.error);
  if (!id.success) return { ok: false, message: "Некорректные данные" };
  return done(await guard((a) => admin.updateMenuItem(a, id.data, parsed.data)), "Изменения сохранены");
}

export async function setMenuItemFlag(id: string, flag: string, value: boolean) {
  return strip(await guard((a) => admin.setMenuItemFlag(a, uuid.parse(id), z.enum(["isAvailable", "isPopular"]).parse(flag), z.boolean().parse(value))));
}

export async function deleteMenuItem(id: string) {
  return strip(
    await guard(async (a) => {
      const publicIds = await admin.deleteMenuItem(a, uuid.parse(id));
      await Promise.allSettled(publicIds.map((p) => deleteImage(p)));
    }),
  );
}

export async function setPrimaryMenuImage(imageId: string) {
  return strip(await guard((a) => admin.setPrimaryMenuImage(a, uuid.parse(imageId))));
}

export async function moveMenuImage(imageId: string, dir: string) {
  return strip(await guard((a) => admin.moveMenuImage(a, uuid.parse(imageId), z.enum(["up", "down"]).parse(dir))));
}

/* -------------------------------------------------------------- categories */

export async function createCategory(_: ActionState, form: FormData): Promise<ActionState> {
  const parsed = categorySchema.safeParse(fields(form));
  if (!parsed.success) return invalid(parsed.error);
  return done(await guard((a) => admin.createCategory(a, parsed.data)), "Категория добавлена");
}

export async function updateCategory(_: ActionState, form: FormData): Promise<ActionState> {
  const parsed = categorySchema.safeParse(fields(form));
  const id = uuid.safeParse(form.get("id"));
  if (!parsed.success) return invalid(parsed.error);
  if (!id.success) return { ok: false, message: "Некорректные данные" };
  return done(await guard((a) => admin.updateCategory(a, id.data, parsed.data)), "Сохранено");
}

export async function deleteCategory(id: string) {
  return strip(await guard((a) => admin.deleteCategory(a, uuid.parse(id))));
}

export async function moveCategory(id: string, dir: string) {
  return strip(await guard((a) => admin.moveCategory(a, uuid.parse(id), z.enum(["up", "down"]).parse(dir))));
}

/* ----------------------------------------------------------------- gallery */

export async function moveGalleryImage(id: string, dir: string) {
  return strip(await guard((a) => admin.moveGalleryImage(a, uuid.parse(id), z.enum(["up", "down"]).parse(dir))));
}

export async function setFeaturedGalleryImage(id: string) {
  return strip(await guard((a) => admin.setFeaturedGalleryImage(a, uuid.parse(id))));
}

/* ----------------------------------------------------------------- reviews */

export async function setReviewApproved(id: string, approved: boolean) {
  return strip(await guard((a) => admin.setReviewApproved(a, uuid.parse(id), z.boolean().parse(approved))));
}

export async function deleteReview(id: string) {
  return strip(await guard((a) => admin.deleteReview(a, uuid.parse(id))));
}

/* ---------------------------------------------------------------- settings */

export async function updateSettings(_: ActionState, form: FormData): Promise<ActionState> {
  const schedule = Array.from({ length: 7 }, (_, i) =>
    form.get(`closed${i}`) ? null : { open: String(form.get(`open${i}`) ?? ""), close: String(form.get(`close${i}`) ?? "") },
  );
  const social = Array.from({ length: 4 }, (_, i) => ({ label: String(form.get(`socialLabel${i}`) ?? ""), href: String(form.get(`socialHref${i}`) ?? "") })).filter((x) => x.label.trim() || x.href.trim());
  const parsed = settingsSchema.safeParse({ ...fields(form), schedule, social });
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  return done(
    await guard((a) =>
      admin.saveSettings(a, {
        name: d.name, description: d.description, social: d.social, phone: d.phone, email: d.email, address: d.address,
        schedule: d.schedule, hours: formatHours(d.schedule),
        reservationDurationMinutes: d.reservationDurationMinutes, slotIntervalMinutes: d.slotIntervalMinutes,
        seatingCapacity: d.seatingCapacity, maxConcurrentReservations: d.maxConcurrentReservations,
        maxPartySize: d.maxPartySize, minNoticeMinutes: d.minNoticeMinutes, bookingHorizonDays: d.bookingHorizonDays,
        autoConfirm: d.autoConfirm,
      }),
    ),
    "Настройки сохранены",
  );
}
