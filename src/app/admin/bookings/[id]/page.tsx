import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BookingActions } from "@/components/admin/booking-actions";
import { StatusBadge } from "@/components/admin/bookings-table";
import { assertAdmin } from "@/lib/session";
import { formatDate } from "@/lib/utils";
import { uuid } from "@/lib/validations";
import { getReservation } from "@/services/admin";

export const metadata: Metadata = { title: "Бронь" };

export default async function BookingPage({ params }: { params: Promise<{ id: string }> }) {
  await assertAdmin();
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const b = await getReservation(id);
  if (!b) notFound();

  const rows: [string, React.ReactNode][] = [
    ["Гость", b.name],
    ["Телефон", <a key="p" href={`tel:${b.phone.replace(/[^\d+]/g, "")}`} className="underline">{b.phone}</a>],
    ["Email", <a key="e" href={`mailto:${b.email}`} className="underline">{b.email}</a>],
    ["Дата и время", `${formatDate(b.reservationDate)}, ${b.reservationTime}`],
    ["Гостей", b.guests],
    ["Длительность", `${b.durationMinutes} мин`],
    ["Комментарий гостя", b.comment || "—"],
    ["Создана", formatDate(b.createdAt.toISOString())],
  ];

  return (
    <div className="max-w-3xl space-y-10">
      <Link href="/admin/bookings" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-terracotta">
        <ArrowLeft className="size-4" /> К списку
      </Link>
      <div className="flex items-center gap-4">
        <h2 className="text-4xl">{b.name}</h2>
        <StatusBadge status={b.status} />
      </div>
      <dl className="divide-y divide-border rounded-xl border border-border bg-card">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[10rem_1fr] gap-4 p-4 text-sm">
            <dt className="text-muted-foreground">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <BookingActions id={b.id} status={b.status} date={b.reservationDate} time={b.reservationTime} note={b.adminNote ?? ""} />
    </div>
  );
}
