import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { getSettings } from "@/services/catalog";
import { getReservationSummary } from "@/services/reservations";

export const metadata: Metadata = { title: "Заявка принята", robots: { index: false } };

export default async function ReservationSuccessPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  const [booking, settings] = await Promise.all([id ? getReservationSummary(id).catch(() => null) : null, getSettings()]);
  const confirmed = booking?.status === "confirmed";

  return (
    <div className="mx-auto max-w-xl px-5 pb-24 pt-40 text-center">
      <CheckCircle2 className="mx-auto size-14 text-terracotta" />
      <h1 className="mt-6 text-5xl">{confirmed ? "Стол забронирован" : "Заявка принята"}</h1>
      {booking ? (
        <>
          <p className="mt-4 text-muted-foreground">
            {booking.name}, ждём вас {formatDate(booking.date)} в {booking.time}. Гостей: {booking.guests}.
          </p>
          <p className="mx-auto mt-4 max-w-md rounded-xl bg-secondary p-4 text-sm">
            {confirmed
              ? "Бронь подтверждена."
              : "Статус: ожидает подтверждения. Администратор свяжется с вами по телефону. Автоматические письма и SMS мы пока не отправляем."}
          </p>
        </>
      ) : (
        <p className="mt-4 text-muted-foreground">Ваша заявка сохранена.</p>
      )}
      <p className="mt-6 text-sm text-muted-foreground">Вопросы — по телефону <a className="underline" href={`tel:${settings.phone.replace(/[^\d+]/g, "")}`}>{settings.phone}</a></p>
      <Link href="/" className={buttonVariants({ variant: "outline", className: "mt-8" })}>На главную</Link>
    </div>
  );
}
