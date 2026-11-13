"use server";

import { and, count, eq, gte } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { contactMessages } from "@/db/schema";
import { clientIpHash } from "@/lib/request";
import { getCurrentUser } from "@/lib/session";
import { contactSchema, reservationSchema } from "@/lib/validations";
import { createReservation as book } from "@/services/reservations";
import type { ActionState } from "@/types";

// Users only ever see these messages. Database/driver errors go to the server log.
const GENERIC_ERROR = "Не удалось отправить заявку. Попробуйте ещё раз чуть позже или позвоните нам.";

const echo = (formData: FormData) => Object.fromEntries([...formData].map(([k, v]) => [k, String(v)]));

export async function createReservation(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = reservationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: "Проверьте поля формы", errors: parsed.error.flatten().fieldErrors, values: echo(formData) };
  }
  const { website, ...input } = parsed.data;

  let id: string;
  if (website) {
    // Honeypot tripped: pretend success, store nothing.
    redirect("/reservation/success");
  }
  try {
    const [user, ipHash] = await Promise.all([getCurrentUser().catch(() => null), clientIpHash()]);
    const res = await book(input, { userId: user?.id, ipHash });
    if (!res.ok) {
      // "unavailable" is expected; the form refreshes its slot list.
      return { ok: false, message: res.message, errors: res.code === "unavailable" ? { time: [res.message] } : undefined, values: echo(formData) };
    }
    id = res.id;
  } catch (e) {
    console.error("[createReservation]", e);
    return { ok: false, message: GENERIC_ERROR, values: echo(formData) };
  }
  redirect(`/reservation/success?id=${id}`);
}

const CONTACT_LIMIT = 3; // messages per IP per 10 minutes

export async function sendContactMessage(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = contactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: "Проверьте поля формы", errors: parsed.error.flatten().fieldErrors, values: echo(formData) };
  }
  const { website, ...data } = parsed.data;
  if (website) return { ok: true, message: "Сообщение отправлено." }; // honeypot

  try {
    const ipHash = await clientIpHash();
    if (ipHash) {
      const since = new Date(Date.now() - 10 * 60_000);
      const [{ n }] = await db.select({ n: count() }).from(contactMessages).where(and(eq(contactMessages.ipHash, ipHash), gte(contactMessages.createdAt, since)));
      if (n >= CONTACT_LIMIT) return { ok: false, message: "Слишком много сообщений. Попробуйте через несколько минут.", values: echo(formData) };
    }
    await db.insert(contactMessages).values({ ...data, email: data.email ?? null, phone: data.phone ?? null, ipHash });
    // No email/SMS provider is configured, so no notification is sent; the message is stored for the admin panel.
    return { ok: true, message: "Сообщение получено. Мы свяжемся с вами по указанным контактам." };
  } catch (e) {
    console.error("[sendContactMessage]", e);
    return { ok: false, message: GENERIC_ERROR, values: echo(formData) };
  }
}
