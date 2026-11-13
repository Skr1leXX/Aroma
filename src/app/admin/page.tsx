import Image from "next/image";
import Link from "next/link";
import { CalendarCheck, CalendarClock, CalendarX, FolderTree, Utensils, Users } from "lucide-react";
import { StatusBadge } from "@/components/admin/bookings-table";
import { assertAdmin } from "@/lib/session";
import { formatDate, formatPrice } from "@/lib/utils";
import { getDashboard } from "@/services/admin";

const dayLabel = (iso: string) => new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(new Date(`${iso}T00:00:00Z`));

export default async function DashboardPage() {
  await assertAdmin();
  const d = await getDashboard();
  const max = Math.max(1, ...d.chart.map((c) => c.count));

  const cards = [
    { label: "Бронирований сегодня", value: d.stats.today, icon: Users },
    { label: "Ждут подтверждения", value: d.stats.pending, icon: CalendarClock, href: "/admin/bookings?status=pending" },
    { label: "Подтверждённые (предстоящие)", value: d.stats.confirmed, icon: CalendarCheck, href: "/admin/bookings?status=confirmed" },
    { label: "Отменённые", value: d.stats.cancelled, icon: CalendarX, href: "/admin/bookings?status=cancelled" },
    { label: `Блюд (в меню: ${d.dishes.visible})`, value: d.dishes.total, icon: Utensils, href: "/admin/menu" },
    { label: "Категорий", value: d.categories, icon: FolderTree, href: "/admin/categories" },
  ];

  return (
    <div className="min-w-0 space-y-12">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ label, value, icon: Icon, href }) => {
          const body = (
            <>
              <Icon className="size-5 text-terracotta" />
              <p className="mt-4 font-heading text-5xl">{value}</p>
              <p className="text-sm text-muted-foreground">{label}</p>
            </>
          );
          return href ? (
            <Link key={label} href={href} className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-terracotta">{body}</Link>
          ) : (
            <div key={label} className="rounded-xl border border-border bg-card p-6">{body}</div>
          );
        })}
      </div>

      <section aria-labelledby="chart-title" className="rounded-xl border border-border bg-card p-6">
        <h2 id="chart-title" className="text-3xl">Бронирования по дням</h2>
        <p className="text-sm text-muted-foreground">6 дней назад — 7 дней вперёд, без отклонённых и отменённых</p>
        <ol className="mt-8 flex h-48 items-end gap-1.5 sm:gap-3">
          {d.chart.map((c) => (
            <li key={c.date} className="flex h-full flex-1 flex-col items-center justify-end gap-2" title={`${dayLabel(c.date)}: ${c.count}`}>
              <span className="text-xs text-muted-foreground">{c.count || ""}</span>
              <div className={`w-full rounded-t ${c.isToday ? "bg-terracotta" : "bg-espresso/70"}`} style={{ height: `${Math.max(c.count > 0 ? 6 : 2, (c.count / max) * 100)}%` }} />
              <span className={`text-[10px] sm:text-xs ${c.isToday ? "font-semibold text-terracotta" : "text-muted-foreground"}`}>
                <span className="lg:hidden">{Number(c.date.slice(8))}</span>
                <span className="hidden whitespace-nowrap lg:inline">{dayLabel(c.date)}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid gap-10 lg:grid-cols-2">
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-3xl">Последние бронирования</h2>
            <Link href="/admin/bookings" className="text-sm text-terracotta hover:underline">Все</Link>
          </div>
          {d.latest.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Бронирований пока нет</p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border bg-card">
              {d.latest.map((b) => (
                <li key={b.id}>
                  <Link href={`/admin/bookings/${b.id}`} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-secondary/50">
                    <div>
                      <p className="font-medium">{b.name} · {b.guests} гост.</p>
                      <p className="text-sm text-muted-foreground">{formatDate(b.reservationDate)}, {b.reservationTime}</p>
                    </div>
                    <StatusBadge status={b.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-3xl">Популярные блюда</h2>
          {d.popular.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Отметьте блюда как популярные в разделе «Меню»</p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border bg-card">
              {d.popular.map((p) => (
                <li key={p.id} className="flex items-center gap-4 p-4">
                  <Image src={p.image ?? "/placeholder.svg"} alt="" width={48} height={48} className="size-12 rounded-lg object-cover" />
                  <Link href={`/admin/menu/${p.id}`} className="flex-1 font-medium hover:text-terracotta">{p.name}</Link>
                  <span className="text-sm text-muted-foreground">{formatPrice(Number(p.price))}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
