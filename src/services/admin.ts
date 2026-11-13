// Admin-side domain operations. They take the acting admin explicitly and are free of Next.js APIs,
// so they can be tested on any Postgres. Authorisation happens in the callers (actions/route handlers).
// Every mutation writes one row to audit_log containing only the fields that changed.
import { and, asc, count, type AnyColumn, desc, eq, gte, ilike, inArray, lte, ne, or, sql } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { getTxDb } from "@/db/transactional";
import * as s from "@/db/schema";
import { localNow, addDays } from "@/lib/booking";
import { isUniqueViolation, UserError } from "@/lib/errors";
import { slugify } from "@/lib/slug";
import type { ReservationStatus } from "@/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyPg = PgDatabase<any, typeof s>;
export type Admin = { id: string; email: string };

const { reservations: R, menuItems: M, menuCategories: C, menuItemImages: MI, galleryImages: G, reviews: V } = s;

/* ------------------------------------------------------------------ audit */

export async function audit(
  database: AnyPg, admin: Admin, action: string, entity: string, entityId: string | null, details?: Record<string, unknown>,
) {
  try {
    await database.insert(s.auditLog).values({ userId: admin.id, userEmail: admin.email, action, entity, entityId, details: details ?? null });
  } catch (e) {
    console.error("[audit] could not write log entry", action, e); // the change itself already succeeded
  }
}

/** { field: [before, after] } for the fields that actually changed. */
export function changes<T extends Record<string, unknown>>(before: T, after: Partial<T>) {
  const out: Record<string, [unknown, unknown]> = {};
  for (const k of Object.keys(after)) {
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) out[k] = [before[k], after[k]];
  }
  return out;
}

export async function listAudit(page: number, pageSize = 30, database: AnyPg = db) {
  const [{ total }] = await database.select({ total: count() }).from(s.auditLog);
  const rows = await database.select().from(s.auditLog).orderBy(desc(s.auditLog.createdAt)).limit(pageSize).offset((page - 1) * pageSize);
  return { rows, total, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

/* -------------------------------------------------------------- dashboard */

export async function getDashboard(database: AnyPg = db, now = new Date()) {
  const today = localNow(now).date;
  const from = addDays(today, -6);
  const to = addDays(today, 7);

  const n = (where: ReturnType<typeof sql>) => sql<number>`count(*) filter (where ${where})::int`;
  const [stats] = await database
    .select({
      today: n(sql`${R.reservationDate} = ${today} and ${R.status} in ('pending','confirmed')`),
      pending: n(sql`${R.status} = 'pending' and ${R.reservationDate} >= ${today}`),
      confirmed: n(sql`${R.status} = 'confirmed' and ${R.reservationDate} >= ${today}`),
      cancelled: n(sql`${R.status} = 'cancelled'`),
    })
    .from(R);

  const [[dishes], [categories], latest, popular, perDay] = await Promise.all([
    database.select({ total: count(), visible: sql<number>`count(*) filter (where ${M.isAvailable})::int` }).from(M),
    database.select({ total: count() }).from(C),
    database.select().from(R).orderBy(desc(R.createdAt)).limit(6),
    database
      .select({ id: M.id, name: M.name, price: M.price, image: MI.url })
      .from(M)
      .leftJoin(MI, and(eq(MI.menuItemId, M.id), eq(MI.isPrimary, true)))
      .where(and(eq(M.isPopular, true), eq(M.isAvailable, true)))
      .orderBy(asc(M.name))
      .limit(5),
    database
      .select({ date: R.reservationDate, c: sql<number>`count(*)::int` })
      .from(R)
      .where(and(gte(R.reservationDate, from), lte(R.reservationDate, to), inArray(R.status, ["pending", "confirmed"])))
      .groupBy(R.reservationDate),
  ]);

  const byDate = new Map(perDay.map((r) => [r.date, r.c]));
  const chart = Array.from({ length: 14 }, (_, i) => {
    const date = addDays(from, i);
    return { date, count: byDate.get(date) ?? 0, isToday: date === today };
  });
  return { stats, dishes: { total: dishes.total, visible: dishes.visible }, categories: categories.total, latest, popular, chart };
}

/* ----------------------------------------------------------- reservations */

export type ReservationFilter = { q?: string; status?: ReservationStatus; from?: string; to?: string; page: number };

export async function listReservations(f: ReservationFilter, pageSize = 20, database: AnyPg = db) {
  const q = f.q?.trim();
  const digits = q?.replace(/\D/g, "") ?? "";
  const like = q ? `%${q.replace(/[\\%_]/g, "\\$&")}%` : "";
  const where = and(
    q ? or(ilike(R.name, like), ilike(R.phone, like), digits.length >= 3 ? sql`regexp_replace(${R.phone}, '\\D', '', 'g') like ${`%${digits}%`}` : undefined) : undefined,
    f.status ? eq(R.status, f.status) : undefined,
    f.from ? gte(R.reservationDate, f.from) : undefined,
    f.to ? lte(R.reservationDate, f.to) : undefined,
  );
  const [{ total }] = await database.select({ total: count() }).from(R).where(where);
  const rows = await database
    .select()
    .from(R)
    .where(where)
    .orderBy(desc(R.reservationDate), desc(R.startMinute))
    .limit(pageSize)
    .offset((f.page - 1) * pageSize);
  return { rows, total, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getReservation(id: string, database: AnyPg = db) {
  const [row] = await database.select().from(R).where(eq(R.id, id));
  return row ?? null;
}

// Rejected/cancelled are final: re-activating could overbook seats that were already released.
const transitions: Record<string, ReservationStatus[]> = {
  confirmed: ["pending"],
  rejected: ["pending"],
  cancelled: ["pending", "confirmed"],
};

export async function setReservationStatus(admin: Admin, id: string, next: "confirmed" | "rejected" | "cancelled", database: AnyPg = db) {
  const [done] = await database
    .update(R)
    .set({ status: next })
    .where(and(eq(R.id, id), inArray(R.status, transitions[next])))
    .returning({ id: R.id });
  if (!done) throw new UserError("Это действие недоступно для текущего статуса брони");
  await audit(database, admin, "reservation.status", "reservation", id, { to: next });
}

export async function setReservationNote(admin: Admin, id: string, note: string, database: AnyPg = db) {
  const [done] = await database.update(R).set({ adminNote: note || null }).where(eq(R.id, id)).returning({ id: R.id });
  if (!done) throw new UserError("Бронь не найдена");
  await audit(database, admin, "reservation.note", "reservation", id, { length: note.length });
}

/* ------------------------------------------------------------- categories */

type CategoryInput = { name: string; slug?: string; description: string };

export async function createCategory(admin: Admin, input: CategoryInput, database: AnyPg = db) {
  const [{ top }] = await database.select({ top: sql<number>`coalesce(max(${C.sortOrder}), -1)::int` }).from(C);
  try {
    const [row] = await database
      .insert(C)
      .values({ name: input.name, slug: input.slug ?? slugify(input.name), description: input.description, sortOrder: top + 1 })
      .returning({ id: C.id });
    await audit(database, admin, "category.create", "category", row.id, { name: input.name });
    return row.id;
  } catch (e) {
    if (isUniqueViolation(e)) throw new UserError("Категория с таким slug уже существует");
    throw e;
  }
}

export async function updateCategory(admin: Admin, id: string, input: CategoryInput, database: AnyPg = db) {
  const [before] = await database.select().from(C).where(eq(C.id, id));
  if (!before) throw new UserError("Категория не найдена");
  const next = { name: input.name, slug: input.slug ?? before.slug, description: input.description };
  try {
    await database.update(C).set(next).where(eq(C.id, id));
  } catch (e) {
    if (isUniqueViolation(e)) throw new UserError("Категория с таким slug уже существует");
    throw e;
  }
  await audit(database, admin, "category.update", "category", id, changes(before, next));
}

export async function deleteCategory(admin: Admin, id: string, database: AnyPg = db) {
  const [{ dishes }] = await database.select({ dishes: count() }).from(M).where(eq(M.categoryId, id));
  if (dishes > 0) throw new UserError(`В категории ${dishes} блюд. Сначала перенесите или удалите их.`);
  let removed;
  try {
    [removed] = await database.delete(C).where(eq(C.id, id)).returning({ name: C.name });
  } catch {
    // FK RESTRICT is the safety net when a dish was added between the check and the delete
    throw new UserError("В категории появились блюда. Удаление отменено.");
  }
  if (!removed) throw new UserError("Категория не найдена");
  await audit(database, admin, "category.delete", "category", id, { name: removed.name });
}

/** Re-numbers a list in ONE statement, so the order is never half-applied. */
const renumber = (col: AnyColumn, ids: string[]) =>
  sql`case ${col} ${sql.join(ids.map((id, i) => sql`when ${id}::uuid then ${i}::int`), sql` `)} else 0 end`;

function moved(ids: string[], id: string, dir: "up" | "down") {
  const i = ids.indexOf(id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ids.length) return null;
  const copy = [...ids];
  [copy[i], copy[j]] = [copy[j], copy[i]];
  return copy;
}

export async function moveCategory(admin: Admin, id: string, dir: "up" | "down", database: AnyPg = db) {
  const ids = (await database.select({ id: C.id }).from(C).orderBy(asc(C.sortOrder), asc(C.name))).map((r) => r.id);
  const next = moved(ids, id, dir);
  if (!next) return;
  await database.update(C).set({ sortOrder: renumber(C.id, next) }).where(inArray(C.id, next));
  await audit(database, admin, "category.reorder", "category", id, { dir });
}

/* ------------------------------------------------------------------- menu */

export type MenuInput = {
  categoryId: string; slug?: string; name: string; description: string; price: number; weight: string;
  ingredients: string[]; allergens: string[]; isPopular: boolean; isAvailable: boolean;
};

const toRow = (i: MenuInput) => ({
  categoryId: i.categoryId, name: i.name, description: i.description, price: i.price.toFixed(2), weight: i.weight,
  ingredients: i.ingredients, allergens: i.allergens, isPopular: i.isPopular, isAvailable: i.isAvailable,
});

async function freeSlug(database: AnyPg, base: string) {
  for (let n = 1; ; n++) {
    const slug = n === 1 ? base : `${base}-${n}`.slice(0, 80);
    const [hit] = await database.select({ id: M.id }).from(M).where(eq(M.slug, slug));
    if (!hit) return slug;
  }
}

export async function createMenuItem(admin: Admin, input: MenuInput, database: AnyPg = db) {
  const slug = input.slug ?? (await freeSlug(database, slugify(input.name)));
  try {
    const [row] = await database.insert(M).values({ ...toRow(input), slug }).returning({ id: M.id });
    await audit(database, admin, "menu_item.create", "menu_item", row.id, { name: input.name, price: input.price });
    return row.id;
  } catch (e) {
    if (isUniqueViolation(e)) throw new UserError("Блюдо с таким slug уже существует");
    throw e;
  }
}

export async function updateMenuItem(admin: Admin, id: string, input: MenuInput, database: AnyPg = db) {
  const [before] = await database.select().from(M).where(eq(M.id, id));
  if (!before) throw new UserError("Блюдо не найдено");
  const next = { ...toRow(input), slug: input.slug ?? before.slug };
  try {
    await database.update(M).set(next).where(eq(M.id, id));
  } catch (e) {
    if (isUniqueViolation(e)) throw new UserError("Блюдо с таким slug уже существует");
    throw e;
  }
  await audit(database, admin, "menu_item.update", "menu_item", id, changes(before, next));
}

export async function setMenuItemFlag(admin: Admin, id: string, flag: "isAvailable" | "isPopular", value: boolean, database: AnyPg = db) {
  const [done] = await database.update(M).set({ [flag]: value }).where(eq(M.id, id)).returning({ id: M.id });
  if (!done) throw new UserError("Блюдо не найдено");
  await audit(database, admin, "menu_item.update", "menu_item", id, { [flag]: [!value, value] });
}

/** Returns Cloudinary public ids of the removed images so the caller can delete the files too. */
export async function deleteMenuItem(admin: Admin, id: string, database: AnyPg = db) {
  const images = await database.select({ publicId: MI.publicId }).from(MI).where(eq(MI.menuItemId, id));
  const [removed] = await database.delete(M).where(eq(M.id, id)).returning({ name: M.name });
  if (!removed) throw new UserError("Блюдо не найдено");
  await audit(database, admin, "menu_item.delete", "menu_item", id, { name: removed.name, images: images.length });
  return images.map((i) => i.publicId).filter((p): p is string => !!p);
}

export async function setPrimaryMenuImage(admin: Admin, imageId: string, database: AnyPg = getTxDb()) {
  // The partial unique index allows one primary per dish, so the switch takes two statements.
  // They run in one transaction: readers never see a dish without a main photo.
  const itemId = await database.transaction(async (tx) => {
    const [img] = await tx.select({ itemId: MI.menuItemId }).from(MI).where(eq(MI.id, imageId));
    if (!img) throw new UserError("Фото не найдено");
    await tx.update(MI).set({ isPrimary: false }).where(and(eq(MI.menuItemId, img.itemId), eq(MI.isPrimary, true), ne(MI.id, imageId)));
    await tx.update(MI).set({ isPrimary: true }).where(eq(MI.id, imageId));
    return img.itemId;
  });
  await audit(database, admin, "menu_item.primary_image", "menu_item", itemId, { imageId });
}

export async function moveMenuImage(admin: Admin, imageId: string, dir: "up" | "down", database: AnyPg = db) {
  const [img] = await database.select({ itemId: MI.menuItemId }).from(MI).where(eq(MI.id, imageId));
  if (!img) throw new UserError("Фото не найдено");
  const ids = (await database.select({ id: MI.id }).from(MI).where(eq(MI.menuItemId, img.itemId)).orderBy(asc(MI.sortOrder), asc(MI.createdAt))).map((r) => r.id);
  const next = moved(ids, imageId, dir);
  if (!next) return;
  await database.update(MI).set({ sortOrder: renumber(MI.id, next) }).where(inArray(MI.id, next));
  await audit(database, admin, "menu_item.reorder_images", "menu_item", img.itemId, { dir });
}

/* ---------------------------------------------------------------- gallery */

export async function moveGalleryImage(admin: Admin, imageId: string, dir: "up" | "down", database: AnyPg = db) {
  const ids = (await database.select({ id: G.id }).from(G).orderBy(desc(G.isFeatured), asc(G.sortOrder), desc(G.createdAt))).map((r) => r.id);
  const next = moved(ids, imageId, dir);
  if (!next) return;
  await database.update(G).set({ sortOrder: renumber(G.id, next) }).where(inArray(G.id, next));
  await audit(database, admin, "gallery.reorder", "gallery_image", imageId, { dir });
}

export async function setFeaturedGalleryImage(admin: Admin, imageId: string, database: AnyPg = db) {
  const [img] = await database.select({ id: G.id }).from(G).where(eq(G.id, imageId));
  if (!img) throw new UserError("Фото не найдено");
  // One statement: exactly this image is featured, every other one is not.
  await database.update(G).set({ isFeatured: sql`${G.id} = ${imageId}::uuid` }).where(or(eq(G.isFeatured, true), eq(G.id, imageId)));
  await audit(database, admin, "gallery.featured", "gallery_image", imageId);
}

/* ---------------------------------------------------------------- reviews */

export async function setReviewApproved(admin: Admin, id: string, approved: boolean, database: AnyPg = db) {
  const [done] = await database.update(V).set({ isApproved: approved }).where(eq(V.id, id)).returning({ id: V.id });
  if (!done) throw new UserError("Отзыв не найден");
  await audit(database, admin, approved ? "review.publish" : "review.hide", "review", id);
}

export async function deleteReview(admin: Admin, id: string, database: AnyPg = db) {
  const [removed] = await database.delete(V).where(eq(V.id, id)).returning({ author: V.author, rating: V.rating });
  if (!removed) throw new UserError("Отзыв не найден");
  await audit(database, admin, "review.delete", "review", id, removed);
}

export async function reviewSummary(database: AnyPg = db) {
  const rows = await database.select({ rating: V.rating, c: sql<number>`count(*)::int` }).from(V).groupBy(V.rating);
  const total = rows.reduce((t, r) => t + r.c, 0);
  const avg = total ? rows.reduce((t, r) => t + r.rating * r.c, 0) / total : 0;
  return { total, avg, distribution: [5, 4, 3, 2, 1].map((star) => ({ star, count: rows.find((r) => r.rating === star)?.c ?? 0 })) };
}

/* --------------------------------------------------------------- settings */

export type SettingsInput = Omit<typeof s.restaurantSettings.$inferInsert, "id" | "updatedAt">;

export async function saveSettings(admin: Admin, values: SettingsInput, database: AnyPg = db) {
  const [before] = await database.select().from(s.restaurantSettings).where(eq(s.restaurantSettings.id, 1));
  await database.insert(s.restaurantSettings).values({ id: 1, ...values }).onConflictDoUpdate({ target: s.restaurantSettings.id, set: values });
  await audit(database, admin, "settings.update", "settings", "1", before ? changes(before as Record<string, unknown>, values as Record<string, unknown>) : { created: true });
}

/* ---------------------------------------------------------- menu (editor) */

export async function getMenuItemForEdit(id: string, database: AnyPg = db) {
  const [item] = await database.select().from(M).where(eq(M.id, id));
  if (!item) return null;
  const images = await database.select().from(MI).where(eq(MI.menuItemId, id)).orderBy(asc(MI.sortOrder), asc(MI.createdAt));
  return { item, images };
}
