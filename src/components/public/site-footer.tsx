import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { publicNav } from "@/config/site";
import { getSettings } from "@/services/catalog";

export async function SiteFooter() {
  const s = await getSettings();
  return (
    <footer className="bg-graphite text-background/80">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo className="text-background" />
          <p className="mt-5 max-w-sm text-sm leading-relaxed">{s.description}</p>
        </div>
        <div>
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-[#e39a80]">Навигация</h3>
          <ul className="space-y-2 text-sm">
            {publicNav.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="hover:text-background">{n.label}</Link>
              </li>
            ))}
            <li><Link href="/reservation" className="hover:text-background">Бронирование</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-[#e39a80]">Контакты</h3>
          <address className="space-y-2 text-sm not-italic">
            <p>{s.address}</p>
            <p><a href={`tel:${s.phone.replace(/[^\d+]/g, "")}`} className="hover:text-background">{s.phone}</a></p>
            <p><a href={`mailto:${s.email}`} className="hover:text-background">{s.email}</a></p>
            {s.social.length > 0 && (
              <p className="flex gap-4 pt-2">
                {s.social.map((l) => <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className="hover:text-background">{l.label}</a>)}
              </p>
            )}
          </address>
        </div>
      </div>
      <div className="border-t border-white/10 px-5 py-6 text-center text-xs text-background/50">
        © {new Date().getFullYear()} Aroma. Все права защищены.
        {process.env.DEMO_MODE === "true" && (
          <p className="mx-auto mt-3 max-w-2xl text-background/70">
            Демонстрационный проект: Aroma — вымышленный ресторан. Заявки не обрабатываются, письма и SMS не отправляются.
          </p>
        )}
      </div>
    </footer>
  );
}
