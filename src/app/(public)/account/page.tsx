import type { Metadata } from "next";
import Link from "next/link";
import { StatusBadge } from "@/components/admin/bookings-table";
import { SignOutButton } from "@/components/public/sign-out-button";
import { EmptyState } from "@/components/shared/states";
import { buttonVariants } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { requireUser } from "@/lib/session";
import { getMyReservations } from "@/services/catalog";

export const metadata: Metadata = { title: "Личный кабинет" };

export default async function AccountPage() {
  const user = await requireUser();
  const bookings = await getMyReservations(user.id);

  return (
    <div className="mx-auto max-w-3xl px-5 pb-24 pt-36">
      <h1 className="text-5xl">{user.name}</h1>
      <p className="mt-2 text-muted-foreground">{user.email}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        {user.role === "admin" && <Link href="/admin" className={buttonVariants()}>Админ-панель</Link>}
        <SignOutButton />
      </div>

      <h2 className="mb-4 mt-14 text-3xl">Мои бронирования</h2>
      {bookings.length === 0 ? (
        <EmptyState title="Бронирований пока нет">
          <Link href="/reservation" className={buttonVariants({ variant: "outline" })}>Забронировать стол</Link>
        </EmptyState>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {bookings.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium">{formatDate(b.date)}, {b.time}</p>
                <p className="text-sm text-muted-foreground">{b.guests} гост.</p>
              </div>
              <StatusBadge status={b.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
