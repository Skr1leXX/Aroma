import type { Metadata } from "next";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { ContactForm } from "@/components/public/contact-form";
import { PageHero } from "@/components/shared/section-heading";
import { siteConfig } from "@/config/site";
import { getSettings } from "@/services/catalog";

export const metadata: Metadata = { title: "Контакты" };

const { lat, lng } = siteConfig.coordinates;
const d = 0.004;
const mapSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d},${lat - d / 2},${lng + d},${lat + d / 2}&layer=mapnik&marker=${lat},${lng}`;

export default async function ContactsPage() {
  const s = await getSettings();
  const tel = s.phone.replace(/[^\d+]/g, "");
  return (
    <>
      <PageHero eyebrow="Контакты" title="Как нас найти" />
      <section className="mx-auto grid max-w-6xl gap-14 px-5 py-20 lg:grid-cols-2">
        <div className="space-y-8">
          <ul className="space-y-5 text-lg">
            <li className="flex gap-4"><MapPin className="mt-1 size-5 shrink-0 text-terracotta" /> {s.address}</li>
            <li className="flex gap-4"><Phone className="mt-1 size-5 shrink-0 text-terracotta" /><a href={`tel:${tel}`}>{s.phone}</a></li>
            <li className="flex gap-4"><Mail className="mt-1 size-5 shrink-0 text-terracotta" /><a href={`mailto:${s.email}`}>{s.email}</a></li>
            <li className="flex gap-4">
              <Clock className="mt-1 size-5 shrink-0 text-terracotta" />
              <div>{s.hours.map((h) => <p key={h.days}>{h.days}: {h.time}</p>)}</div>
            </li>
          </ul>
          <iframe title="Карта: расположение Aroma" src={mapSrc} loading="lazy" className="h-80 w-full rounded-2xl border border-border" />
        </div>
        <div>
          <h2 className="text-4xl">Напишите нам</h2>
          <p className="mb-8 mt-2 text-muted-foreground">Вопросы, банкеты, сотрудничество — ответим в течение рабочего дня.</p>
          <ContactForm />
        </div>
      </section>
    </>
  );
}
