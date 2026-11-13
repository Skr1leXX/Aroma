import type { Metadata } from "next";
import Link from "next/link";
import { BookingsTable, statusLabel } from "@/components/admin/bookings-table";
import { Pager } from "@/components/admin/pager";
import { selectClass } from "@/components/public/form-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { assertAdmin } from "@/lib/session";
import { reservationFilterSchema } from "@/lib/validations";
import { listReservations } from "@/services/admin";

export const metadata: Metadata = { title: "Бронирования" };

export default async function BookingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await assertAdmin();
  const f = reservationFilterSchema.parse(await searchParams);
  const { rows, total, pages } = await listReservations(f);

  return (
    <>
      <form className="mb-6 grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_auto]" role="search">
        <Input name="q" defaultValue={f.q} placeholder="Имя или телефон" aria-label="Поиск по имени или телефону" />
        <select name="status" defaultValue={f.status ?? ""} className={selectClass} aria-label="Статус">
          <option value="">Все статусы</option>
          {Object.entries(statusLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <Input name="from" type="date" defaultValue={f.from} aria-label="Дата с" />
        <Input name="to" type="date" defaultValue={f.to} aria-label="Дата по" />
        <div className="flex gap-2">
          <Button type="submit">Найти</Button>
          <Link href="/admin/bookings" className="grid place-items-center px-3 text-sm text-muted-foreground hover:text-foreground">Сбросить</Link>
        </div>
      </form>
      <p className="mb-3 text-sm text-muted-foreground">Найдено: {total}</p>
      <BookingsTable rows={rows} />
      <Pager page={f.page} pages={pages} basePath="/admin/bookings" params={{ q: f.q, status: f.status, from: f.from, to: f.to }} />
    </>
  );
}
