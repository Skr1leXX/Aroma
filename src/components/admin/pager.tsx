import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Prev/next links that keep the other query params. */
export function Pager({ page, pages, basePath, params }: { page: number; pages: number; basePath: string; params: Record<string, string | undefined> }) {
  if (pages <= 1) return null;
  const href = (p: number) => {
    const q = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => !!e[1]));
    q.set("page", String(p));
    return `${basePath}?${q}`;
  };
  return (
    <nav aria-label="Страницы" className="mt-6 flex items-center justify-between text-sm">
      {page > 1 ? <Link href={href(page - 1)} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>← Назад</Link> : <span />}
      <span className="text-muted-foreground">Страница {page} из {pages}</span>
      {page < pages ? <Link href={href(page + 1)} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>Вперёд →</Link> : <span />}
    </nav>
  );
}
