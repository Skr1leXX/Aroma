"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { deleteMenuItem, setMenuItemFlag } from "@/actions/admin";
import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPrice } from "@/lib/utils";
import type { Category, Dish } from "@/types";

export function MenuTable({ initial, categories }: { initial: Dish[]; categories: Category[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [, start] = useTransition();
  // Server is the source of truth: after every successful operation the page data is refetched.
  const run = (job: () => Promise<{ ok: boolean; message?: string }>) =>
    start(async () => {
      const res = await job();
      setError(res.ok ? "" : (res.message ?? "Ошибка"));
      if (res.ok) router.refresh();
    });
  const shown = initial.filter((d) => d.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <>
      <Input aria-label="Поиск блюда" placeholder="Поиск по названию…" value={q} onChange={(e) => setQ(e.target.value)} className="mb-6 max-w-sm" />
      {error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}
      {shown.length === 0 ? (
        <EmptyState title="Ничего не найдено" text="Измените запрос или добавьте блюдо." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Блюдо</TableHead><TableHead>Категория</TableHead><TableHead>Цена</TableHead>
                <TableHead>Популярное</TableHead><TableHead>В меню</TableHead><TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Image src={d.image} alt="" width={48} height={48} className="size-12 rounded-lg object-cover" />
                      <Link href={`/admin/menu/${d.id}`} className="font-medium hover:text-terracotta">{d.name}</Link>
                    </div>
                  </TableCell>
                  <TableCell>{categories.find((c) => c.id === d.categoryId)?.name}</TableCell>
                  <TableCell>{formatPrice(d.price)}</TableCell>
                  <TableCell><Switch aria-label={`Популярное: ${d.name}`} checked={d.popular} onCheckedChange={(v) => run(() => setMenuItemFlag(d.id, "isPopular", v))} /></TableCell>
                  <TableCell><Switch aria-label={`В меню: ${d.name}`} checked={d.available} onCheckedChange={(v) => run(() => setMenuItemFlag(d.id, "isAvailable", v))} /></TableCell>
                  <TableCell className="space-x-1 text-right whitespace-nowrap">
                    <Link href={`/admin/menu/${d.id}`} aria-label={`Редактировать ${d.name}`} className="inline-grid size-8 place-items-center rounded-lg hover:bg-secondary"><Pencil className="size-4" /></Link>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Удалить ${d.name}`}
                      onClick={() => confirm(`Удалить «${d.name}» вместе с фотографиями? Действие необратимо.`) && run(() => deleteMenuItem(d.id))}
                    >
                      <Trash2 />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
