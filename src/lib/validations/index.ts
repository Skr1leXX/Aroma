import { z } from "zod";

const phone = z
  .string()
  .trim()
  .regex(/^\+?[\d\s()-]{10,18}$/, "Введите корректный телефон");

const email = z.string().trim().toLowerCase().email("Введите корректный email");

// Empty form fields arrive as "" — treat them as missing.
const blank = <T extends z.ZodType>(schema: T) => z.preprocess((v) => (v === "" ? undefined : v), schema.optional());

export const uuid = z.uuid("Некорректный идентификатор");

/** Calendar/clock FORMAT only. Whether the slot is open and free is decided on the server (services/reservations). */
export const reservationSchema = z.object({
  name: z.string().trim().min(2, "Укажите имя").max(80),
  phone,
  email,
  date: z.string({ error: "Выберите дату" }).regex(/^\d{4}-\d{2}-\d{2}$/, "Выберите дату"),
  time: z.string({ error: "Выберите время" }).regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Выберите время"),
  guests: z.coerce.number().int("Укажите число гостей").min(1, "От 1 гостя").max(50),
  comment: blank(z.string().trim().max(500, "Не более 500 символов")),
  idempotencyKey: uuid,
  website: z.string().max(200).optional(), // honeypot: real users leave it empty; checked in the action, never reported as a field error
});

export const contactSchema = z
  .object({
    name: z.string().trim().min(2, "Укажите имя").max(80),
    email: blank(email),
    phone: blank(phone),
    message: z.string().trim().min(10, "Сообщение слишком короткое").max(1000, "Не более 1000 символов"),
    website: z.string().max(200).optional(),
  })
  .refine((v) => v.email || v.phone, { path: ["email"], message: "Укажите телефон или email" });

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Формат ЧЧ:ММ");

const social = z.object({
  label: z.string().trim().min(1).max(30),
  href: z.string().trim().url("Ссылка должна начинаться с https://").refine((u) => u.startsWith("https://"), "Только https-ссылки").max(300),
});

export const settingsSchema = z.object({
  name: z.string().trim().min(2, "Укажите название").max(60),
  description: z.string().trim().min(10, "Слишком короткое описание").max(400),
  social: z.array(social).max(6),
  phone,
  email,
  address: z.string().trim().min(5, "Укажите адрес"),
  schedule: z
    .array(z.object({ open: hhmm, close: hhmm }).nullable())
    .length(7),
  reservationDurationMinutes: z.coerce.number().int().min(30).max(480),
  slotIntervalMinutes: z.coerce.number().int().min(15).max(240),
  seatingCapacity: z.coerce.number().int().min(1).max(1000),
  maxConcurrentReservations: z.coerce.number().int().min(1).max(500),
  maxPartySize: z.coerce.number().int().min(1).max(50),
  minNoticeMinutes: z.coerce.number().int().min(0).max(10080),
  bookingHorizonDays: z.coerce.number().int().min(1).max(365),
  autoConfirm: z.coerce.boolean().default(false),
});

export type ReservationInput = z.infer<typeof reservationSchema>;
export type ContactInput = z.infer<typeof contactSchema>;

export const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Только латиница, цифры и дефисы");

const list = z
  .string()
  .transform((s) => s.split(",").map((x) => x.trim()).filter(Boolean))
  .pipe(z.array(z.string().max(60)).max(30));

export const menuItemSchema = z.object({
  categoryId: uuid,
  slug: blank(slugSchema),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(10).max(600),
  price: z.coerce.number().positive("Цена должна быть больше нуля").max(1_000_000),
  weight: z.string().trim().max(30).default(""),
  ingredients: list,
  allergens: list,
  isPopular: z.coerce.boolean().default(false),
  isAvailable: z.coerce.boolean().default(false),
});

export const categorySchema = z.object({
  slug: blank(slugSchema),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(200).default(""),
});

export const galleryMetaSchema = z.object({
  group: z.enum(["dishes", "interior", "events", "team", "restaurant"]),
  alt: z.string().trim().min(2, "Добавьте описание фото").max(200),
  caption: z.string().trim().max(200).optional(),
});

/** Public menu filters coming from the URL. Anything odd falls back to "no filter". */
export const menuQuerySchema = z.object({
  category: z.string().regex(/^[a-z0-9-]{1,80}$/).optional().catch(undefined),
  q: z.string().trim().max(60).optional().catch(undefined),
});

export const availabilityQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guests: z.coerce.number().int().min(1).max(50),
});

export const rescheduleSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Выберите дату"),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Выберите время"),
});

export const adminNoteSchema = z.string().trim().max(1000, "Не более 1000 символов");

export const reservationFilterSchema = z.object({
  q: z.string().trim().max(60).optional().catch(undefined),
  status: z.enum(["pending", "confirmed", "rejected", "cancelled"]).optional().catch(undefined),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10000).catch(1),
});

export const pageSchema = z.object({ page: z.coerce.number().int().min(1).max(10000).catch(1) });
