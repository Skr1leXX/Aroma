import Link from "next/link";
import { EmptyState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import type { ReservationStatus } from "@/types";

export const statusLabel: Record<ReservationStatus, string> = {
  pending: "Ожидает", confirmed: "Подтверждена", rejected: "Отклонена", cancelled: "Отменена",
};

export function StatusBadge({ status }: { status: ReservationStatus }) {
  const cls = {
    pending: "bg-terracotta/15 text-terracotta",
    confirmed: "bg-emerald-100 text-emerald-800",
    rejected: "bg-red-100 text-red-800",
    cancelled: "bg-muted text-muted-foreground",
  }[status];
  return <Badge className={cls}>{statusLabel[status]}</Badge>;
}

type Row = {
  id: string; name: string; phone: string; email: string; reservationDate: string; reservationTime: string;
  guests: number; status: ReservationStatus; adminNote: string | null;
};

/** Server-rendered: filtering, search and paging happen in SQL (see services/admin.listReservations). */
export function BookingsTable({ rows }: { rows: Row[] }) {
  if (rows.length === 0) return <EmptyState title="Ничего не найдено" text="Измените фильтры или поисковый запрос." />;
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Гость</TableHead><TableHead>Дата и время</TableHead><TableHead>Гостей</TableHead>
            <TableHead>Статус</TableHead><TableHead className="text-right">Подробности</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                <p className="font-medium">{r.name}</p>
                <p className="text-xs text-muted-foreground">{r.phone} · {r.email}</p>
                {r.adminNote && <p className="mt-1 text-xs italic">заметка: {r.adminNote.slice(0, 60)}</p>}
              </TableCell>
              <TableCell>{formatDate(r.reservationDate)}, {r.reservationTime}</TableCell>
              <TableCell>{r.guests}</TableCell>
              <TableCell><StatusBadge status={r.status} /></TableCell>
              <TableCell className="text-right">
                <Link href={`/admin/bookings/${r.id}`} className="text-sm text-terracotta hover:underline">Открыть</Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
