import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { DishCard } from "@/components/public/dish-card";
import { EmptyState } from "@/components/shared/states";
import { PageHero } from "@/components/shared/section-heading";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { menuQuerySchema } from "@/lib/validations";
import { cn } from "@/lib/utils";
import { getCategories, getDishes } from "@/services/catalog";

export const metadata: Metadata = { title: "Меню" };

export default async function MenuPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const { category, q } = menuQuerySchema.parse({
    category: typeof raw.category === "string" ? raw.category : undefined,
    q: typeof raw.q === "string" ? raw.q : undefined,
  });
  const [categories, dishes] = await Promise.all([getCategories(), getDishes({ category, q })]);
  const tabs = [{ slug: undefined, name: "Всё меню" }, ...categories];
  const href = (slug?: string) => {
    const p = new URLSearchParams();
    if (slug) p.set("category", slug);
    if (q) p.set("q", q);
    return p.size ? `/menu?${p}` : "/menu";
  };

  return (
    <>
      <PageHero eyebrow="Меню" title="Что мы готовим" description="Карта меняется с сезоном. Если у вас есть аллергии — скажите официанту, мы подберём замену." />
      <section className="mx-auto max-w-6xl px-5 py-16">
        <form action="/menu" role="search" className="mb-8 flex max-w-md gap-2">
          {category && <input type="hidden" name="category" value={category} />}
          <Input name="q" defaultValue={q} placeholder="Поиск по названию блюда" aria-label="Поиск по названию блюда" maxLength={60} />
          <Button type="submit" aria-label="Найти"><Search /></Button>
        </form>

        <nav aria-label="Категории меню" className="-mx-5 mb-12 flex gap-2 overflow-x-auto px-5 pb-2">
          {tabs.map((t) => {
            const active = t.slug === category;
            return (
              <Link
                key={t.name}
                href={href(t.slug)}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "whitespace-nowrap rounded-full border px-5 py-2 text-sm transition-colors",
                  active ? "border-espresso bg-espresso text-background" : "border-border hover:border-terracotta",
                )}
              >
                {t.name}
              </Link>
            );
          })}
        </nav>

        {dishes.length === 0 ? (
          <EmptyState
            title={q ? `По запросу «${q}» ничего не найдено` : "В этой категории пока нет блюд"}
            text={q ? "Проверьте написание или сбросьте фильтры." : "Загляните в другой раздел меню."}
          >
            <Link href="/menu" className={cn(buttonVariants({ variant: "outline" }))}>Показать всё меню</Link>
          </EmptyState>
        ) : (
          <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {dishes.map((d, i) => (
              <DishCard key={d.id} dish={d} priority={i < 3} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
