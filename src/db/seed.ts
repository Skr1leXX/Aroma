// Demo data for the Aroma concept. Idempotent: categories/items are keyed by slug,
// and bookings/reviews/gallery are only inserted into empty tables.
import type { PgDatabase } from "drizzle-orm/pg-core";
import { categories } from "@/data/categories";
import { galleryImages as galleryData, reservations as reservationData, reviews as reviewData } from "@/data/content";
import { dishes } from "@/data/dishes";
import { defaultSchedule } from "@/config/booking";
import { siteConfig } from "@/config/site";
import { formatHours } from "@/lib/booking";
import * as s from "./schema";

// Any Drizzle Postgres database (Neon over HTTP in production, PGlite in local verification).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPg = PgDatabase<any, typeof s>;

const daysFromNow = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

export async function seed(db: AnyPg) {
  // categories
  const categoryIds = new Map<string, string>(); // demo id ("c1") -> uuid
  for (const [i, c] of categories.entries()) {
    await db.insert(s.menuCategories).values({ slug: c.slug, name: c.name, description: c.description, sortOrder: i }).onConflictDoNothing();
  }
  const catRows = await db.select().from(s.menuCategories);
  for (const c of categories) categoryIds.set(c.id, catRows.find((r) => r.slug === c.slug)!.id);

  // menu items + primary image
  for (const d of dishes) {
    const inserted = await db
      .insert(s.menuItems)
      .values({
        categoryId: categoryIds.get(d.categoryId)!,
        slug: d.slug,
        name: d.name,
        description: d.description,
        price: d.price.toFixed(2),
        weight: d.weight,
        ingredients: d.ingredients,
        allergens: d.allergens,
        isPopular: d.popular,
        isAvailable: d.available,
      })
      .onConflictDoNothing()
      .returning({ id: s.menuItems.id });
    if (inserted[0]) {
      // External demo photo (no Cloudinary public_id). Real uploads go through /api/admin/images.
      await db.insert(s.menuItemImages).values({ menuItemId: inserted[0].id, url: d.image, isPrimary: true });
    }
  }

  const empty = async (table: typeof s.reservations | typeof s.reviews | typeof s.galleryImages) =>
    (await db.select().from(table).limit(1)).length === 0;

  if (await empty(s.reservations)) {
    await db.insert(s.reservations).values(
      reservationData.map((r, i) => ({
        name: r.name, phone: r.phone, email: r.email, reservationDate: daysFromNow(i % 7),
        reservationTime: r.time, guests: r.guests, comment: r.comment ?? null, status: r.status,
      })),
    );
  }

  if (await empty(s.reviews)) {
    await db.insert(s.reviews).values(
      reviewData.map((r) => ({ author: r.author, rating: r.rating, text: r.text, isApproved: r.approved, createdAt: new Date(r.date) })),
    );
  }

  if (await empty(s.galleryImages)) {
    await db.insert(s.galleryImages).values(galleryData.map((g, i) => ({ group: g.group, alt: g.alt, url: g.src, sortOrder: i })));
  }

  await db
    .insert(s.restaurantSettings)
    .values({ id: 1, phone: siteConfig.phone, email: siteConfig.email, address: siteConfig.address, hours: formatHours(defaultSchedule), schedule: defaultSchedule })
    .onConflictDoNothing();
}
