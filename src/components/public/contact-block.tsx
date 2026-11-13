import Link from "next/link";
import { Clock, MapPin, Phone } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { getSettings } from "@/services/catalog";
import { cn } from "@/lib/utils";

export async function ContactBlock() {
  const s = await getSettings();
  return (
    <section className="bg-terracotta px-5 py-20 text-white">
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-2 md:items-center">
        <div>
          <h2 className="text-5xl leading-none sm:text-6xl">Ждём вас сегодня вечером</h2>
          <Link href="/reservation" className={cn(buttonVariants({ size: "lg" }), "mt-8 bg-espresso text-background hover:bg-espresso/90")}>
            Забронировать стол
          </Link>
        </div>
        <ul className="space-y-5 text-lg">
          <li className="flex gap-4"><MapPin className="mt-1 size-5 shrink-0" /> {s.address}</li>
          <li className="flex gap-4">
            <Phone className="mt-1 size-5 shrink-0" />
            <a href={`tel:${s.phone.replace(/[^\d+]/g, "")}`}>{s.phone}</a>
          </li>
          <li className="flex gap-4">
            <Clock className="mt-1 size-5 shrink-0" />
            <span>{s.hours.map((h) => `${h.days}: ${h.time}`).join(" · ")}</span>
          </li>
        </ul>
      </div>
    </section>
  );
}
