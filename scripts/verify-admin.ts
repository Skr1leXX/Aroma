// Offline check of the admin domain layer (dashboard numbers, reservations search/filter, status rules,
// reschedule, categories, menu, images order, gallery, reviews, settings, audit log, role gate) on PGlite.
//   npm run verify:admin       (does not touch Neon or Cloudinary)
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as s from "@/db/schema";
import { seed } from "@/db/seed";
import { addDays, dayIndex, localNow } from "@/lib/booking";
import { UserError } from "@/lib/errors";
import { assertAdminUser, ForbiddenError } from "@/lib/roles";
import { slugify } from "@/lib/slug";
import * as admin from "@/services/admin";
import { moveReservation } from "@/services/reservations";

let failed = 0;
const check = (name: string, ok: boolean, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failed++;
};
const userError = async (name: string, p: Promise<unknown>) =>
  check(name, await p.then(() => false, (e) => e instanceof UserError));

async function main() {
  const db = drizzle(new PGlite(), { schema: s });
  await migrate(db, { migrationsFolder: "./drizzle" });
  await seed(db);

  const [u] = await db.insert(s.users).values({ name: "Admin", email: "admin@example.com" }).returning();
  const me: admin.Admin = { id: u.id, email: u.email };
  const auditCount = async () => (await admin.listAudit(1, 1000, db)).total;

  // role gate -----------------------------------------------------------------------------------
  const throwsForbidden = (fn: () => unknown) => { try { fn(); return false; } catch (e) { return e instanceof ForbiddenError; } };
  check("gate: anonymous refused", throwsForbidden(() => assertAdminUser(null)));
  check("gate: customer refused", throwsForbidden(() => assertAdminUser({ role: "customer" })));
  check("gate: admin allowed", !throwsForbidden(() => assertAdminUser({ role: "admin" })));
  check("slugify: cyrillic -> latin", slugify("Тальятелле с грибами") === "talyatelle-s-gribami" && slugify("!!!") === "item");

  // dashboard numbers come from real rows ----------------------------------------------------------
  await db.delete(s.reservations);
  const today = localNow().date;
  const mk = (date: string, status: "pending" | "confirmed" | "rejected" | "cancelled", name: string, phone = "+7 900 000 0000") => ({
    name, phone, email: `${name.toLowerCase().replace(/\W/g, "")}@example.com`, reservationDate: date, reservationTime: "19:00", guests: 2, status,
  });
  await db.insert(s.reservations).values([
    mk(today, "pending", "Anna Pending"), mk(today, "confirmed", "Boris Confirmed", "+7 (916) 111-22-33"),
    mk(addDays(today, 1), "confirmed", "Clara Tomorrow"), mk(addDays(today, -1), "cancelled", "Dmitry Cancelled"),
    mk(addDays(today, 3), "rejected", "Elena Rejected"),
  ]);
  const dash = await admin.getDashboard(db);
  check("dashboard: today / pending / confirmed / cancelled", dash.stats.today === 2 && dash.stats.pending === 1 && dash.stats.confirmed === 2 && dash.stats.cancelled === 1, JSON.stringify(dash.stats));
  check("dashboard: dishes and categories", dash.dishes.total === 20 && dash.dishes.visible === 19 && dash.categories === 6, JSON.stringify(dash.dishes));
  check("dashboard: popular dishes are popular and visible", dash.popular.length > 0 && dash.popular.length <= 5);
  const chartOf = (d: string) => dash.chart.find((c) => c.date === d)?.count;
  check("dashboard chart: 14 days, active bookings only", dash.chart.length === 14 && chartOf(today) === 2 && chartOf(addDays(today, 1)) === 1 && chartOf(addDays(today, -1)) === 0 && chartOf(addDays(today, 3)) === 0);
  check("dashboard: latest bookings", dash.latest.length === 5);

  // reservations: search / filter / paging ---------------------------------------------------------
  const lr = (f: Partial<admin.ReservationFilter>) => admin.listReservations({ page: 1, ...f }, 20, db);
  check("search by name (case-insensitive part)", (await lr({ q: "boris" })).total === 1);
  check("search by phone digits ignores formatting", (await lr({ q: "9161112233" })).total === 1);
  check("search treats % literally", (await lr({ q: "%" })).total === 0);
  check("filter by status", (await lr({ status: "confirmed" })).total === 2);
  check("filter by date range", (await lr({ from: today, to: today })).total === 2);
  check("combined filters", (await lr({ status: "confirmed", from: addDays(today, 1) })).total === 1);
  const p1 = await admin.listReservations({ page: 1 }, 2, db);
  const p3 = await admin.listReservations({ page: 3 }, 2, db);
  check("paging", p1.rows.length === 2 && p1.pages === 3 && p3.rows.length === 1);

  // statuses ---------------------------------------------------------------------------------------
  const pending = (await lr({ q: "Anna" })).rows[0];
  const before = await auditCount();
  await admin.setReservationStatus(me, pending.id, "confirmed", db);
  check("pending -> confirmed", (await admin.getReservation(pending.id, db))?.status === "confirmed");
  await userError("confirmed -> rejected is refused", admin.setReservationStatus(me, pending.id, "rejected", db));
  await admin.setReservationStatus(me, pending.id, "cancelled", db);
  await userError("cancelled is final", admin.setReservationStatus(me, pending.id, "confirmed", db));
  check("status changes are audited (2 entries)", (await auditCount()) - before === 2);
  await admin.setReservationNote(me, pending.id, "VIP, окно", db);
  check("admin note saved", (await admin.getReservation(pending.id, db))?.adminNote === "VIP, окно");

  // reschedule -------------------------------------------------------------------------------------
  let wed = addDays(today, 8);
  while (dayIndex(wed) !== 2) wed = addDays(wed, 1);
  const [a, b] = await db.insert(s.reservations).values([{ ...mk(wed, "confirmed", "Move Me"), reservationTime: "13:00", guests: 4 }, { ...mk(wed, "pending", "Blocker"), reservationTime: "19:00", guests: 4 }]).returning();
  await db.update(s.restaurantSettings).set({ seatingCapacity: 6 });
  const moveTo = (id: string, d: string, t: string) => moveReservation(id, d, t, db);
  check("reschedule to a free slot", (await moveTo(a.id, wed, "15:00")).ok && (await admin.getReservation(a.id, db))?.reservationTime === "15:00");
  const full = await moveTo(a.id, wed, "19:00");
  check("reschedule into a full slot is refused", !full.ok && full.code === "unavailable");
  check("a booking does not block its own slot", (await moveTo(b.id, wed, "20:00")).ok);
  const late = await moveTo(a.id, wed, "22:00");
  check("reschedule outside hours is refused", !late.ok && late.code === "outside_hours");
  const closedDay = await moveTo(a.id, addDays(today, -2), "19:00");
  check("reschedule to the past is refused", !closedDay.ok && closedDay.code === "past");
  const inactive = await moveTo(pending.id, wed, "12:00");
  check("cancelled booking cannot be moved", !inactive.ok && inactive.code === "inactive");

  // categories -------------------------------------------------------------------------------------
  const catId = await admin.createCategory(me, { name: "Бранч", description: "Утро" }, db);
  const [cat] = await db.select().from(s.menuCategories).where(eq(s.menuCategories.id, catId));
  check("category: slug generated, sorted last", cat.slug === "branch" && cat.sortOrder === 6);
  await userError("category: duplicate slug refused", admin.createCategory(me, { name: "Другой", slug: "branch", description: "" }, db));
  await admin.updateCategory(me, catId, { name: "Бранч-меню", description: "Утро" }, db);
  check("category: renamed, slug kept", (await db.select().from(s.menuCategories).where(eq(s.menuCategories.id, catId)))[0].slug === "branch");
  await admin.moveCategory(me, catId, "up", db);
  const order = (await db.select().from(s.menuCategories).orderBy(s.menuCategories.sortOrder)).map((c) => c.slug);
  check("category: move up changes order", order.at(-2) === "branch" && order.length === 7, order.join(","));
  await admin.moveCategory(me, catId, "down", db);
  check("category: move down restores", (await db.select().from(s.menuCategories).orderBy(s.menuCategories.sortOrder)).at(-1)?.slug === "branch");
  const [withDishes] = await db.select().from(s.menuCategories).where(eq(s.menuCategories.slug, "pasta"));
  await userError("category with dishes cannot be deleted", admin.deleteCategory(me, withDishes.id, db));
  await admin.deleteCategory(me, catId, db);
  check("empty category deleted", (await db.select().from(s.menuCategories)).length === 6);

  // menu items + images ----------------------------------------------------------------------------
  const base: admin.MenuInput = { categoryId: withDishes.id, name: "Паста карбонара", description: "Классическая римская паста", price: 750, weight: "300 г", ingredients: ["паста", "гуанчале"], allergens: ["глютен"], isPopular: false, isAvailable: true };
  const id1 = await admin.createMenuItem(me, base, db);
  await admin.createMenuItem(me, base, db);
  const slugs = (await db.select({ slug: s.menuItems.slug }).from(s.menuItems).where(eq(s.menuItems.categoryId, withDishes.id))).map((r) => r.slug);
  check("menu: slug auto-generated and made unique", slugs.includes("pasta-karbonara") && slugs.includes("pasta-karbonara-2"));
  await userError("menu: explicit duplicate slug refused", admin.createMenuItem(me, { ...base, slug: "pasta-karbonara" }, db));
  await admin.updateMenuItem(me, id1, { ...base, price: 790, isPopular: true }, db);
  const upd = (await admin.listAudit(1, 5, db)).rows.find((r) => r.action === "menu_item.update");
  check("menu: update audited with before/after, no whole record", JSON.stringify(upd?.details?.price) === JSON.stringify(["750.00", "790.00"]) && !("description" in (upd?.details ?? {})), JSON.stringify(upd?.details));
  await admin.setMenuItemFlag(me, id1, "isAvailable", false, db);
  check("menu: availability flag", (await admin.getMenuItemForEdit(id1, db))?.item.isAvailable === false);

  const imgs = await db.insert(s.menuItemImages).values([
    { menuItemId: id1, url: "u1", publicId: "aroma/dishes/one", isPrimary: true, sortOrder: 0 },
    { menuItemId: id1, url: "u2", publicId: "aroma/dishes/two", sortOrder: 1 },
    { menuItemId: id1, url: "u3", publicId: "aroma/dishes/three", sortOrder: 2 },
  ]).returning();
  await admin.setPrimaryMenuImage(me, imgs[2].id, db);
  const flags = (await admin.getMenuItemForEdit(id1, db))!.images.map((i) => i.isPrimary);
  check("images: exactly one primary after switching", JSON.stringify(flags) === "[false,false,true]");
  await admin.moveMenuImage(me, imgs[2].id, "up", db);
  check("images: reorder", (await admin.getMenuItemForEdit(id1, db))!.images.map((i) => i.url).join() === "u1,u3,u2");
  const removed = await admin.deleteMenuItem(me, id1, db);
  check("delete dish returns Cloudinary ids and cascades images", removed.length === 3 && (await db.select().from(s.menuItemImages).where(eq(s.menuItemImages.menuItemId, id1))).length === 0);
  await userError("delete missing dish -> user error", admin.deleteMenuItem(me, id1, db));

  // gallery ----------------------------------------------------------------------------------------
  const gal = (await db.select().from(s.galleryImages).orderBy(s.galleryImages.sortOrder)).map((g) => g.id);
  await admin.setFeaturedGalleryImage(me, gal[3], db);
  await admin.setFeaturedGalleryImage(me, gal[5], db);
  const featured = (await db.select().from(s.galleryImages).where(eq(s.galleryImages.isFeatured, true))).map((g) => g.id);
  check("gallery: exactly one featured image", featured.length === 1 && featured[0] === gal[5]);
  await admin.moveGalleryImage(me, gal[0], "down", db);
  check("gallery: reorder", (await db.select().from(s.galleryImages).where(eq(s.galleryImages.id, gal[0])))[0].sortOrder !== 0);

  // reviews ----------------------------------------------------------------------------------------
  const rv = (await db.select().from(s.reviews).where(eq(s.reviews.isApproved, false)))[0];
  await admin.setReviewApproved(me, rv.id, true, db);
  await admin.setReviewApproved(me, rv.id, false, db);
  const sum = await admin.reviewSummary(db);
  check("reviews: summary", sum.total === 4 && Math.abs(sum.avg - 4.75) < 1e-9 && sum.distribution[0].star === 5 && sum.distribution[0].count === 3, JSON.stringify(sum));
  await admin.deleteReview(me, rv.id, db);
  check("reviews: delete", (await admin.reviewSummary(db)).total === 3);

  // settings + audit -------------------------------------------------------------------------------
  const [cur] = await db.select().from(s.restaurantSettings);
  const { id: _id, updatedAt: _u, ...values } = cur;
  void _id; void _u;
  await admin.saveSettings(me, { ...values, name: "Aroma Test", social: [{ label: "Instagram", href: "https://instagram.com/aroma" }], maxPartySize: 8 }, db);
  const st = (await admin.listAudit(1, 5, db)).rows.find((r) => r.action === "settings.update");
  check("settings saved + audited with changed keys only", (await db.select().from(s.restaurantSettings))[0].name === "Aroma Test" && Object.keys(st?.details ?? {}).sort().join() === "maxPartySize,name,social", Object.keys(st?.details ?? {}).join());
  const log = await admin.listAudit(1, 1000, db);
  check("audit: newest first, user + action + time recorded", log.rows.length > 20 && log.rows.every((r) => r.userEmail === "admin@example.com" && r.action && r.createdAt) && log.rows[0].createdAt >= log.rows.at(-1)!.createdAt);
  check("audit: no secrets in details", !/password|secret|token/i.test(JSON.stringify(log.rows.map((r) => r.details))));

  console.log(failed ? `\n${failed} check(s) FAILED` : "\nAll admin checks passed");
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
