import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Flame, Leaf, Star, Wine } from "lucide-react";
import { ContactBlock } from "@/components/public/contact-block";
import { DishCard } from "@/components/public/dish-card";
import { Reveal } from "@/components/shared/reveal";
import { SectionHeading } from "@/components/shared/section-heading";
import { buttonVariants } from "@/components/ui/button";
import { img } from "@/data/images";
import { cn, formatDate } from "@/lib/utils";
import { getPopularDishes, getReviews } from "@/services/catalog";

const advantages = [
  { icon: Flame, title: "Живой огонь", text: "Большая часть блюд готовится на углях — вкус, который не повторить на плите." },
  { icon: Leaf, title: "Сезонные продукты", text: "Работаем с фермерами из Подмосковья и меняем меню вместе с сезоном." },
  { icon: Wine, title: "Авторская винная карта", text: "Сорок позиций из Италии, Франции и Грузии — подберём пару к любому блюду." },
];

const outlineBtn = cn(buttonVariants({ size: "lg", variant: "outline" }), "border-background/60 bg-transparent text-background hover:bg-background hover:text-espresso");

export default async function HomePage() {
  const [popular, reviews] = await Promise.all([getPopularDishes(), getReviews()]);

  return (
    <>
      {/* Hero */}
      <section className="relative isolate flex min-h-[100svh] items-end overflow-hidden bg-espresso text-background">
        <Image src={img.hero} alt="Сервированный стол в ресторане Aroma" fill priority sizes="100vw" className="-z-20 object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-espresso via-espresso/50 to-espresso/20" />
        <div className="mx-auto w-full max-w-6xl px-5 pb-16 pt-40 sm:pb-24">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.35em] text-[#e39a80]">Современная европейская кухня</p>
          <h1 className="max-w-4xl text-[clamp(3.25rem,10vw,8rem)] leading-[0.92]">
            Огонь, соль<br />и <em className="text-[#e39a80]">сезон</em>
          </h1>
          <p className="mt-8 max-w-lg text-lg text-background/80">
            Ужин, который хочется растянуть. Сезонные продукты, живой огонь и зал, где никто не торопится.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/reservation" className={cn(buttonVariants({ size: "lg" }), "bg-terracotta px-8 text-white hover:bg-terracotta/90")}>
              Забронировать стол
            </Link>
            <Link href="/menu" className={outlineBtn}>Смотреть меню</Link>
          </div>
        </div>
      </section>

      {/* About */}
      <section className="mx-auto grid max-w-6xl gap-12 px-5 py-24 md:grid-cols-2 md:items-center">
        <Reveal>
          <SectionHeading
            eyebrow="О ресторане"
            title="Кухня без суеты, сервис без пафоса"
            description="Aroma — это небольшой зал на сорок мест в центре Москвы. Шеф Марко Росси соединяет итальянскую школу с французской техникой и местными продуктами. Мы верим: если продукт хорош, ему нужно совсем немного."
          />
          <Link href="/about" className="mt-8 inline-flex items-center gap-2 border-b border-terracotta pb-1 text-sm font-medium hover:gap-3 transition-all">
            Наша история <ArrowRight className="size-4" />
          </Link>
        </Reveal>
        <Reveal delay={150} className="relative">
          <div className="relative aspect-[4/5] overflow-hidden rounded-t-[999px] rounded-b-xl">
            <Image src={img.interiorHall} alt="Зал ресторана Aroma" fill sizes="(min-width:768px) 40vw, 100vw" className="object-cover" />
          </div>
          <div className="absolute -bottom-6 -left-4 rounded-xl bg-terracotta p-6 text-white shadow-xl sm:-left-8">
            <p className="font-heading text-5xl">2018</p>
            <p className="text-sm">год открытия</p>
          </div>
        </Reveal>
      </section>

      {/* Popular dishes */}
      {popular.length > 0 && <section className="bg-secondary py-24">
        <div className="mx-auto max-w-6xl px-5">
          <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
            <SectionHeading eyebrow="Выбор гостей" title="Популярные блюда" />
            <Link href="/menu" className="inline-flex items-center gap-2 text-sm font-medium hover:text-terracotta">
              Всё меню <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {popular.slice(0, 3).map((d, i) => (
              <Reveal key={d.id} delay={i * 120}>
                <DishCard dish={d} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>}

      {/* Advantages */}
      <section className="mx-auto max-w-6xl px-5 py-24">
        <SectionHeading eyebrow="Почему Aroma" title="Три причины вернуться" align="center" />
        <div className="mt-16 grid gap-10 md:grid-cols-3">
          {advantages.map(({ icon: Icon, title, text }, i) => (
            <Reveal key={title} delay={i * 120} className="border-t border-espresso/20 pt-6">
              <Icon className="size-7 text-terracotta" />
              <h3 className="mt-5 text-3xl">{title}</h3>
              <p className="mt-3 text-muted-foreground">{text}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Interior */}
      <section className="bg-espresso py-24 text-background">
        <div className="mx-auto max-w-6xl px-5">
          <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
            <SectionHeading eyebrow="Атмосфера" title="Место, где приятно задержаться" className="[&_p]:text-background/70" />
            <Link href="/gallery" className="inline-flex items-center gap-2 text-sm font-medium text-[#e39a80]">
              Вся галерея <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-3 md:grid-rows-2">
            {[
              { src: img.interiorDark, alt: "Вечерний зал", cls: "md:row-span-2 aspect-[3/4] md:aspect-auto" },
              { src: img.terrace, alt: "Терраса", cls: "aspect-[4/3]" },
              { src: img.interiorCafe, alt: "Зона у окна", cls: "aspect-[4/3]" },
              { src: img.wine, alt: "Дегустация вина", cls: "aspect-[4/3] md:col-span-2" },
            ].map((p, i) => (
              <Reveal key={p.src} delay={i * 100} className={cn("relative overflow-hidden rounded-xl", p.cls)}>
                <Image src={p.src} alt={p.alt} fill sizes="(min-width:768px) 33vw, 100vw" className="object-cover" />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Reviews: published ones only; section hidden when there are none */}
      {reviews.length > 0 && <section className="mx-auto max-w-6xl px-5 py-24">
        <SectionHeading eyebrow="Отзывы" title="Что говорят гости" />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {reviews.slice(0, 3).map((r, i) => (
            <Reveal key={r.id} delay={i * 120}>
              <figure className="flex h-full flex-col rounded-2xl border border-border bg-card p-7">
                <div className="flex gap-0.5 text-terracotta" aria-label={`Оценка ${r.rating} из 5`}>
                  {Array.from({ length: r.rating }, (_, k) => <Star key={k} className="size-4 fill-current" />)}
                </div>
                <blockquote className="mt-4 flex-1 font-heading text-xl leading-snug">«{r.text}»</blockquote>
                <figcaption className="mt-6 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{r.author}</span> · {formatDate(r.date)}
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </section>}

      <ContactBlock />
    </>
  );
}
