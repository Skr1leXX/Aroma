import type { Metadata } from "next";
import { Star } from "lucide-react";
import { ReviewsList } from "@/components/admin/reviews-list";
import { assertAdmin } from "@/lib/session";
import { reviewSummary } from "@/services/admin";
import { getReviews } from "@/services/catalog";

export const metadata: Metadata = { title: "Отзывы" };

export default async function AdminReviewsPage() {
  await assertAdmin();
  const [reviews, summary] = await Promise.all([getReviews({ approvedOnly: false }), reviewSummary()]);
  const max = Math.max(1, ...summary.distribution.map((d) => d.count));

  return (
    <div className="space-y-8">
      <section aria-label="Рейтинг" className="flex flex-wrap items-center gap-10 rounded-xl border border-border bg-card p-6">
        <div>
          <p className="font-heading text-6xl">{summary.total ? summary.avg.toFixed(1) : "—"}</p>
          <p className="flex items-center gap-1 text-sm text-muted-foreground"><Star className="size-4 fill-current text-terracotta" /> средняя оценка · {summary.total} отзывов</p>
        </div>
        <ul className="min-w-60 flex-1 space-y-1.5">
          {summary.distribution.map((d) => (
            <li key={d.star} className="flex items-center gap-3 text-sm">
              <span className="w-6">{d.star}★</span>
              <div className="h-2 flex-1 overflow-hidden rounded bg-secondary"><div className="h-full bg-terracotta" style={{ width: `${(d.count / max) * 100}%` }} /></div>
              <span className="w-6 text-right text-muted-foreground">{d.count}</span>
            </li>
          ))}
        </ul>
      </section>
      <ReviewsList initial={reviews} />
    </div>
  );
}
