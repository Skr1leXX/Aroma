import { sql } from "drizzle-orm";
import {
  boolean, check, date, index, integer, jsonb, numeric, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid,
} from "drizzle-orm/pg-core";
import { defaultSchedule, type Schedule } from "@/config/booking";
import { users } from "./auth";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
};

export const userRoleEnum = pgEnum("user_role", ["customer", "admin"]);
export const reservationStatusEnum = pgEnum("reservation_status", ["pending", "confirmed", "rejected", "cancelled"]);
export const galleryGroupEnum = pgEnum("gallery_group", ["dishes", "interior", "events", "team", "restaurant"]);

/** Cloudinary asset metadata shared by every image table. */
// A function: sharing one column-builder object between tables makes Drizzle reuse the first table's constraint names.
const imageAsset = () => ({
  url: text("url").notNull(),
  publicId: text("public_id").unique(), // null for external/seed images not stored in Cloudinary
  width: integer("width"),
  height: integer("height"),
  format: text("format"),
  bytes: integer("bytes"),
});

export const profiles = pgTable("profiles", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  ...timestamps,
});

// One role per user. Written only by server code (signup hook / admin seed), never from client input.
export const userRoles = pgTable("user_roles", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  role: userRoleEnum("role").default("customer").notNull(),
  ...timestamps,
});

export const menuCategories = pgTable("menu_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").default("").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  ...timestamps,
});

export const menuItems = pgTable(
  "menu_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    categoryId: uuid("category_id").notNull().references(() => menuCategories.id, { onDelete: "restrict" }),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    weight: text("weight").default("").notNull(),
    ingredients: text("ingredients").array().default(sql`'{}'::text[]`).notNull(),
    allergens: text("allergens").array().default(sql`'{}'::text[]`).notNull(),
    isPopular: boolean("is_popular").default(false).notNull(),
    isAvailable: boolean("is_available").default(true).notNull(),
    ...timestamps,
  },
  (t) => [
    index("menu_items_category_idx").on(t.categoryId),
    check("menu_items_price_positive", sql`${t.price} > 0`),
  ],
);

export const menuItemImages = pgTable(
  "menu_item_images",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    menuItemId: uuid("menu_item_id").notNull().references(() => menuItems.id, { onDelete: "cascade" }),
    ...imageAsset(),
    isPrimary: boolean("is_primary").default(false).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("menu_item_images_item_idx").on(t.menuItemId),
    uniqueIndex("menu_item_images_one_primary").on(t.menuItemId).where(sql`${t.isPrimary}`),
  ],
);

export const reservations = pgTable(
  "reservations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    email: text("email").notNull(),
    reservationDate: date("reservation_date", { mode: "string" }).notNull(),
    reservationTime: text("reservation_time").notNull(), // "HH:MM"
    guests: integer("guests").notNull(),
    comment: text("comment"),
    durationMinutes: integer("duration_minutes").default(120).notNull(),
    // Minutes since midnight, derived from reservation_time; used by the overlap query.
    startMinute: integer("start_minute").generatedAlwaysAs(
      sql`(split_part(reservation_time, ':', 1)::int * 60 + split_part(reservation_time, ':', 2)::int)`,
    ),
    status: reservationStatusEnum("status").default("pending").notNull(),
    adminNote: text("admin_note"),
    idempotencyKey: text("idempotency_key").unique(), // double-submit protection
    ipHash: text("ip_hash"), // salted hash, for rate limiting only
    ...timestamps,
  },
  (t) => [
    index("reservations_slot_idx").on(t.reservationDate, t.reservationTime),
    index("reservations_date_status_idx").on(t.reservationDate, t.status),
    index("reservations_ip_idx").on(t.ipHash, t.createdAt),
    index("reservations_status_idx").on(t.status),
    index("reservations_user_idx").on(t.userId),
    check("reservations_guests_range", sql`${t.guests} between 1 and 12`),
    check("reservations_time_format", sql`${t.reservationTime} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'`),
  ],
);

export const restaurantSettings = pgTable(
  "restaurant_settings",
  {
    id: integer("id").primaryKey().default(1), // singleton row
    name: text("name").default("Aroma").notNull(),
    description: text("description").default("Современная европейская кухня: сезонные продукты, живой огонь и спокойная тёплая атмосфера.").notNull(),
    social: jsonb("social").$type<{ label: string; href: string }[]>().default([]).notNull(),
    phone: text("phone").notNull(),
    email: text("email").notNull(),
    address: text("address").notNull(),
    hours: jsonb("hours").$type<{ days: string; time: string }[]>().notNull(), // display text, derived from schedule
    schedule: jsonb("schedule").$type<Schedule>().default(defaultSchedule).notNull(),
    reservationDurationMinutes: integer("reservation_duration_minutes").default(120).notNull(),
    slotIntervalMinutes: integer("slot_interval_minutes").default(60).notNull(),
    seatingCapacity: integer("seating_capacity").default(40).notNull(),
    maxConcurrentReservations: integer("max_concurrent_reservations").default(12).notNull(),
    maxPartySize: integer("max_party_size").default(12).notNull(),
    minNoticeMinutes: integer("min_notice_minutes").default(60).notNull(),
    bookingHorizonDays: integer("booking_horizon_days").default(60).notNull(),
    autoConfirm: boolean("auto_confirm").default(false).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [check("restaurant_settings_singleton", sql`${t.id} = 1`)],
);

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    author: text("author").notNull(),
    rating: integer("rating").notNull(),
    text: text("text").notNull(),
    isApproved: boolean("is_approved").default(false).notNull(),
    ...timestamps,
  },
  (t) => [
    index("reviews_approved_idx").on(t.isApproved, t.createdAt),
    check("reviews_rating_range", sql`${t.rating} between 1 and 5`),
  ],
);

export const galleryImages = pgTable(
  "gallery_images",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    group: galleryGroupEnum("group").notNull(),
    alt: text("alt").notNull(),
    caption: text("caption"),
    isFeatured: boolean("is_featured").default(false).notNull(),
    ...imageAsset(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("gallery_images_group_idx").on(t.group, t.sortOrder)],
);

export const contactMessages = pgTable(
  "contact_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    message: text("message").notNull(),
    ipHash: text("ip_hash"),
    isRead: boolean("is_read").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("contact_messages_created_idx").on(t.createdAt),
    index("contact_messages_ip_idx").on(t.ipHash, t.createdAt),
    check("contact_messages_has_contact", sql`${t.email} is not null or ${t.phone} is not null`),
  ],
);

/** Append-only trail of admin actions. `details` holds changed fields only — never secrets or whole records. */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    userEmail: text("user_email").notNull(), // snapshot: survives account deletion
    action: text("action").notNull(), // e.g. "menu_item.update"
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    details: jsonb("details").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("audit_log_created_idx").on(t.createdAt),
    index("audit_log_entity_idx").on(t.entity, t.entityId),
  ],
);
