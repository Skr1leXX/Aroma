import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Image from "next/image";
import { ReservationForm } from "@/components/public/reservation-form";
import { ErrorState } from "@/components/shared/states";
import { SectionHeading } from "@/components/shared/section-heading";
import { img } from "@/data/images";
import { addDays, localNow } from "@/lib/booking";
import { getSettings } from "@/services/catalog";
import { loadRules } from "@/services/reservations";

export const metadata: Metadata = { title: "Бронирование" };

export default async function ReservationPage() {
  const s = await getSettings();
  const rules = await loadRules().catch(() => null); // never show raw errors; render a friendly state instead
  const today = localNow().date;

  return (
    <div className="mx-auto grid max-w-6xl gap-14 px-5 pb-24 pt-36 lg:grid-cols-[1.1fr_0.9fr]">
      <div>
        <SectionHeading as="h1" eyebrow="Бронирование" title="Забронируйте стол" description="Выберите дату и время — покажем только свободные. Для больших компаний позвоните нам." />
        <div className="mt-10">
          {rules ? (
            <ReservationForm idempotencyKey={randomUUID()} minDate={today} maxDate={addDays(today, rules.horizonDays)} maxGuests={rules.maxPartySize} />
          ) : (
            <ErrorState title="Онлайн-бронирование временно недоступно" text="Позвоните нам — забронируем стол по телефону." />
          )}
        </div>
      </div>
      <aside className="space-y-6 lg:pt-28">
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
          <Image src={img.interiorHall} alt="Зал Aroma" fill sizes="(min-width:1024px) 40vw, 100vw" className="object-cover" />
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 text-sm">
          <h2 className="text-2xl">Режим работы</h2>
          <ul className="mt-3 space-y-1">
            {s.hours.map((h) => (
              <li key={h.days} className="flex justify-between"><span>{h.days}</span><span className="text-muted-foreground">{h.time}</span></li>
            ))}
          </ul>
          <p className="mt-4 text-muted-foreground">Или позвоните: <a className="text-foreground underline" href={`tel:${s.phone.replace(/[^\d+]/g, "")}`}>{s.phone}</a></p>
        </div>
      </aside>
    </div>
  );
}
