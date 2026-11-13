"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { deleteReview, setReviewApproved } from "@/actions/admin";
import { EmptyState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatDate } from "@/lib/utils";
import type { Review } from "@/types";

type Filter = "all" | "published" | "hidden";
const filters: [Filter, string][] = [["all", "Все"], ["published", "Опубликованные"], ["hidden", "Скрытые"]];

export function ReviewsList({ initial }: { initial: Review[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState("");
  const [, start] = useTransition();
  const run = (job: () => Promise<{ ok: boolean; message?: string }>) =>
    start(async () => {
      const res = await job();
      setError(res.ok ? "" : (res.message ?? "Ошибка"));
      if (res.ok) router.refresh();
    });

  const rows = initial.filter((r) => (filter === "all" ? true : filter === "published" ? r.approved : !r.approved));

  return (
    <>
      <div className="mb-6 flex flex-wrap gap-2">
        {filters.map(([v, l]) => (
          <Button key={v} size="sm" variant={filter === v ? "default" : "outline"} onClick={() => setFilter(v)}>{l}</Button>
        ))}
      </div>
      {error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}
      {rows.length === 0 ? (
        <EmptyState title="Отзывов нет" />
      ) : (
        <ul className="space-y-4">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-card p-6">
              <div className="max-w-2xl">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="font-medium">{r.author}</p>
                  <span className="flex text-terracotta" role="img" aria-label={`Оценка ${r.rating} из 5`}>
                    {Array.from({ length: 5 }, (_, i) => <Star key={i} className={cn("size-3.5", i < r.rating && "fill-current")} />)}
                  </span>
                  <Badge className={r.approved ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground"}>{r.approved ? "Опубликован" : "Скрыт"}</Badge>
                </div>
                <p className="mt-2 text-sm">{r.text}</p>
                <p className="mt-2 text-xs text-muted-foreground">{formatDate(r.date)}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant={r.approved ? "outline" : "default"} onClick={() => run(() => setReviewApproved(r.id, !r.approved))}>{r.approved ? "Скрыть" : "Опубликовать"}</Button>
                <Button size="sm" variant="ghost" onClick={() => confirm("Удалить отзыв безвозвратно?") && run(() => deleteReview(r.id))}>Удалить</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
