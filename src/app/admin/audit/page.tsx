import type { Metadata } from "next";
import { Pager } from "@/components/admin/pager";
import { EmptyState } from "@/components/shared/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { assertAdmin } from "@/lib/session";
import { pageSchema } from "@/lib/validations";
import { listAudit } from "@/services/admin";

export const metadata: Metadata = { title: "Журнал действий" };

const fmt = new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "medium", timeZone: "Europe/Moscow" });

/** { field: [before, after] } -> "field: before → after"; anything else -> compact JSON. */
function summarize(details: Record<string, unknown> | null) {
  if (!details || !Object.keys(details).length) return "—";
  return Object.entries(details)
    .map(([k, v]) => (Array.isArray(v) && v.length === 2 ? `${k}: ${String(v[0])} → ${String(v[1])}` : `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`))
    .join("; ")
    .slice(0, 240);
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await assertAdmin();
  const { page } = pageSchema.parse(await searchParams);
  const { rows, total, pages } = await listAudit(page);

  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">Записей: {total}. Секретные данные в журнал не попадают.</p>
      {rows.length === 0 ? (
        <EmptyState title="Журнал пуст" text="Здесь появятся действия администраторов." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Когда</TableHead><TableHead>Кто</TableHead><TableHead>Действие</TableHead><TableHead>Объект</TableHead><TableHead>Изменения</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">{fmt.format(r.createdAt)}</TableCell>
                  <TableCell>{r.userEmail}</TableCell>
                  <TableCell><code className="text-xs">{r.action}</code></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.entity}{r.entityId ? ` · ${r.entityId.slice(0, 8)}` : ""}</TableCell>
                  <TableCell className="max-w-md text-xs">{summarize(r.details)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Pager page={page} pages={pages} basePath="/admin/audit" params={{}} />
    </>
  );
}
