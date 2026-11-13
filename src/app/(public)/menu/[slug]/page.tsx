import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Flame, TriangleAlert } from "lucide-react";
import { DishCard } from "@/components/public/dish-card";
import { SectionHeading } from "@/components/shared/section-heading";
import { buttonVariants } from "@/components/ui/button";
import { cn, formatPrice } from "@/lib/utils";
import { getCategories, getDish, getSimilarDishes } from "@/services/catalog";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const dish = await getDish((await params).slug);
  return dish ? { title: dish.name, description: dish.description } : {};
}

export default async function DishPage({ params }: Props) {
  const { slug } = await params;
  const dish = await getDish(slug);
  if (!dish) notFound();
  const [similar, categories] = await Promise.all([getSimilarDishes(slug), getCategories()]);
  const category = categories.find((c) => c.id === dish.categoryId);

  return (
    <>
      <article className="mx-auto max-w-6xl px-5 pb-24 pt-32">
        <Link href="/menu" className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-terracotta">
          <ArrowLeft className="size-4" /> Назад в меню
        </Link>
        <div className="grid gap-12 lg:grid-cols-2">
          <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-secondary lg:sticky lg:top-28 lg:self-start">
            <Image src={dish.image} alt={dish.name} fill priority sizes="(min-width:1024px) 50vw, 100vw" className="object-cover" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-terracotta">{category?.name}</p>
            <h1 className="mt-3 text-5xl leading-[1.02] sm:text-6xl">{dish.name}</h1>
            {dish.popular && (
              <p className="mt-4 inline-flex items-center gap-1 rounded-full bg-terracotta px-3 py-1 text-xs font-medium text-white">
                <Flame className="size-3" /> Популярное блюдо
              </p>
            )}
            <p className="mt-6 text-lg text-muted-foreground">{dish.description}</p>

            <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border">
              <div className="bg-card p-5">
                <dt className="text-xs uppercase tracking-widest text-muted-foreground">Цена</dt>
                <dd className="mt-1 font-heading text-3xl">{formatPrice(dish.price)}</dd>
              </div>
              <div className="bg-card p-5">
                <dt className="text-xs uppercase tracking-widest text-muted-foreground">Вес / объём</dt>
                <dd className="mt-1 font-heading text-3xl">{dish.weight}</dd>
              </div>
            </dl>

            <h2 className="mt-10 text-3xl">Состав</h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {dish.ingredients.map((i) => (
                <li key={i} className="rounded-full bg-secondary px-4 py-1.5 text-sm">{i}</li>
              ))}
            </ul>

            {dish.allergens.length > 0 && (
              <p className="mt-8 flex items-start gap-3 rounded-xl border border-terracotta/30 bg-terracotta/5 p-4 text-sm">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-terracotta" />
                <span><b>Аллергены:</b> {dish.allergens.join(", ")}</span>
              </p>
            )}

            <Link href="/reservation" className={cn(buttonVariants({ size: "lg" }), "mt-10 bg-terracotta px-8 text-white hover:bg-terracotta/90")}>
              Забронировать стол
            </Link>
          </div>
        </div>
      </article>

      {similar.length > 0 && (
        <section className="bg-secondary py-20">
          <div className="mx-auto max-w-6xl px-5">
            <SectionHeading title="Похожие блюда" />
            <div className="mt-10 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {similar.map((d) => <DishCard key={d.id} dish={d} />)}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
