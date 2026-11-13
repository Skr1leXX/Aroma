// Read-side data service (Drizzle / Neon). Public functions return only public data;
// anything that exposes private data (all reviews, reservations, unread messages) is admin-guarded here,
// so a page cannot forget the check.
import { and, asc, desc, eq, ilike, inArray, ne } from "drizzle-orm";
import { siteConfig } from "@/config/site";
import { team } from "@/data/content";
import { db } from "@/db";
import { contactMessages, galleryImages, menuCategories, menuItemImages, menuItems, reservations, restaurantSettings, reviews } from "@/db/schema";
import { assertAdmin } from "@/lib/session";
import type { Category, Dish, GalleryImage, Reservation, Review } from "@/types";

export const PLACEHOLDER_IMAGE = "/placeholder.svg";

const dishSelect = {
  item: menuItems,
  image: menuItemImages.url,
};

type DishRow = { item: typeof menuItems.$inferSelect; image: string | null };

const toDish = ({ item, image }: DishRow): Dish => ({
  id: item.id,
  slug: item.slug,
  name: item.name,
  description: item.description,
  categoryId: item.categoryId,
  price: Number(item.price),
  weight: item.weight,
  image: image ?? PLACEHOLDER_IMAGE,
  ingredients: item.ingredients,
  allergens: item.allergens,
  popular: item.isPopular,
  available: item.isAvailable,
});

const dishQuery = () =>
  db
    .select(dishSelect)
    .from(menuItems)
    .innerJoin(menuCategories, eq(menuCategories.id, menuItems.categoryId))
    .leftJoin(menuItemImages, and(eq(menuItemImages.menuItemId, menuItems.id), eq(menuItemImages.isPrimary, true)));

export async function getCategories(): Promise<Category[]> {
  const rows = await db.select().from(menuCategories).orderBy(asc(menuCategories.sortOrder), asc(menuCategories.name));
  return rows.map(({ id, slug, name, description }) => ({ id, slug, name, description }));
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, "\\$&");

/**
 * Public menu: only available dishes. `includeHidden` (admin only) also returns switched-off ones.
 * `q` matches the dish name, case-insensitively.
 */
export async function getDishes(opts: { category?: string; q?: string; includeHidden?: boolean } = {}): Promise<Dish[]> {
  if (opts.includeHidden) await assertAdmin();
  const q = opts.q?.trim();
  const rows = await dishQuery()
    .where(
      and(
        opts.includeHidden ? undefined : eq(menuItems.isAvailable, true),
        opts.category ? eq(menuCategories.slug, opts.category) : undefined,
        q ? ilike(menuItems.name, `%${escapeLike(q)}%`) : undefined,
      ),
    )
    .orderBy(asc(menuCategories.sortOrder), asc(menuItems.name));
  return rows.map(toDish);
}

export async function getPopularDishes(): Promise<Dish[]> {
  const rows = await dishQuery().where(and(eq(menuItems.isPopular, true), eq(menuItems.isAvailable, true))).orderBy(asc(menuItems.name));
  return rows.map(toDish);
}

export async function getDish(slug: string): Promise<Dish | null> {
  const [row] = await dishQuery().where(and(eq(menuItems.slug, slug), eq(menuItems.isAvailable, true))).limit(1);
  return row ? toDish(row) : null;
}

export async function getSimilarDishes(slug: string, limit = 3): Promise<Dish[]> {
  const dish = await getDish(slug);
  if (!dish) return [];
  const same = await dishQuery()
    .where(and(eq(menuItems.categoryId, dish.categoryId), ne(menuItems.id, dish.id), eq(menuItems.isAvailable, true)))
    .limit(limit);
  const rows = same.length >= limit ? same : same.concat(
    await dishQuery().where(and(eq(menuItems.isPopular, true), eq(menuItems.isAvailable, true), ne(menuItems.categoryId, dish.categoryId))).limit(limit - same.length),
  );
  return rows.map(toDish);
}

const toReview = (r: typeof reviews.$inferSelect): Review => ({
  id: r.id,
  author: r.author,
  rating: r.rating,
  text: r.text,
  date: r.createdAt.toISOString(),
  approved: r.isApproved,
});

export async function getReviews({ approvedOnly = true } = {}): Promise<Review[]> {
  if (!approvedOnly) await assertAdmin();
  const rows = await db
    .select()
    .from(reviews)
    .where(approvedOnly ? eq(reviews.isApproved, true) : undefined)
    .orderBy(desc(reviews.createdAt));
  return rows.map(toReview);
}

const toGallery = (g: typeof galleryImages.$inferSelect): GalleryImage => ({
  id: g.id,
  src: g.url,
  alt: g.alt,
  group: g.group,
  featured: g.isFeatured,
});

const publicGroups = ["dishes", "interior", "events"] as const;

export async function getGallery({ all = false } = {}): Promise<GalleryImage[]> {
  if (all) await assertAdmin();
  const rows = await db
    .select()
    .from(galleryImages)
    .where(all ? undefined : inArray(galleryImages.group, [...publicGroups]))
    .orderBy(desc(galleryImages.isFeatured), asc(galleryImages.sortOrder), desc(galleryImages.createdAt));
  return rows.map(toGallery);
}

/** Team bios stay in code; their photos can move to Cloudinary via the `team` image kind. */
export const getTeam = async () => team;

export async function getReservations(): Promise<Reservation[]> {
  await assertAdmin();
  const rows = await db.select().from(reservations).orderBy(desc(reservations.createdAt));
  return rows.map(toReservation);
}

export const toReservation = (r: typeof reservations.$inferSelect): Reservation => ({
  id: r.id,
  name: r.name,
  phone: r.phone,
  email: r.email,
  date: r.reservationDate,
  time: r.reservationTime,
  guests: r.guests,
  comment: r.comment ?? undefined,
  status: r.status,
  createdAt: r.createdAt.toISOString(),
});

export async function getMyReservations(userId: string): Promise<Reservation[]> {
  const rows = await db.select().from(reservations).where(eq(reservations.userId, userId)).orderBy(desc(reservations.createdAt));
  return rows.map(toReservation);
}

export async function getUnreadMessageCount(): Promise<number> {
  await assertAdmin();
  const rows = await db.select({ id: contactMessages.id }).from(contactMessages).where(eq(contactMessages.isRead, false));
  return rows.length;
}

export type Settings = { name: string; description: string; social: { label: string; href: string }[]; phone: string; email: string; address: string; hours: { days: string; time: string }[] };

export async function getSettings(): Promise<Settings> {
  try {
    const [row] = await db.select().from(restaurantSettings).where(eq(restaurantSettings.id, 1));
    if (row) return { name: row.name, description: row.description, social: row.social, phone: row.phone, email: row.email, address: row.address, hours: row.hours };
  } catch (e) {
    console.error("[settings] falling back to defaults", e); // footer must not take the whole site down
  }
  return { name: siteConfig.name, description: siteConfig.description, social: [], phone: siteConfig.phone, email: siteConfig.email, address: siteConfig.address, hours: [...siteConfig.hours] };
}
