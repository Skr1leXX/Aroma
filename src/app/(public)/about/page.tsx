import type { Metadata } from "next";
import Image from "next/image";
import { Reveal } from "@/components/shared/reveal";
import { PageHero, SectionHeading } from "@/components/shared/section-heading";
import { ContactBlock } from "@/components/public/contact-block";
import { img } from "@/data/images";
import { getTeam } from "@/services/catalog";

export const metadata: Metadata = { title: "О ресторане" };

const features = [
  ["Три ингредиента", "В каждом блюде — не больше трёх ключевых вкусов. Всё остальное — техника."],
  ["Уголь вместо газа", "Гриль на берёзовых углях задаёт характер мясу, рыбе и овощам."],
  ["Паста по утрам", "Тесто замешивается и раскатывается вручную каждый день до открытия."],
  ["Меню по сезонам", "Четыре раза в год мы обновляем карту, оставляя только классику гостей."],
];

export default async function AboutPage() {
  const team = await getTeam();
  return (
    <>
      <PageHero eyebrow="О ресторане" title="История одного небольшого зала" description="Aroma открылась в 2018 году как семейный проект — с одной печью и четырьмя столами." />

      <section className="mx-auto grid max-w-6xl gap-12 px-5 py-24 md:grid-cols-2">
        <Reveal>
          <SectionHeading eyebrow="История" title="От кухни друзей до ресторана" />
          <div className="mt-6 space-y-4 text-muted-foreground">
            <p>Шеф Марко Росси приехал в Москву из Милана с идеей простой кухни без компромиссов. Первые гости были друзьями, вторые — их друзьями. Через год очередь на ужин растянулась на три недели.</p>
            <p>Сегодня Aroma — это сорок мест, открытая кухня и команда, которая работает вместе с первого дня. Мы по-прежнему не торопим гостей и не гонимся за модой.</p>
          </div>
        </Reveal>
        <Reveal delay={150} className="relative aspect-[4/3] overflow-hidden rounded-xl">
          <Image src={img.interiorDark} alt="Вечерний зал Aroma" fill sizes="(min-width:768px) 45vw, 100vw" className="object-cover" />
        </Reveal>
      </section>

      <section className="bg-secondary py-24">
        <div className="mx-auto max-w-6xl px-5">
          <SectionHeading eyebrow="Концепция" title="Что мы называем особенностями кухни" />
          <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2">
            {features.map(([title, text], i) => (
              <Reveal key={title} delay={i * 80} className="bg-background p-8">
                <span className="font-heading text-3xl text-terracotta">0{i + 1}</span>
                <h3 className="mt-3 text-3xl">{title}</h3>
                <p className="mt-2 text-muted-foreground">{text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-5 py-24 sm:grid-cols-3">
        {[img.grill, img.terrace, img.brunch].map((src) => (
          <Reveal key={src} className="relative aspect-[3/4] overflow-hidden rounded-xl">
            <Image src={src} alt="Фото ресторана Aroma" fill sizes="(min-width:640px) 33vw, 100vw" className="object-cover" />
          </Reveal>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-24">
        <SectionHeading eyebrow="Команда" title="Люди за плитой" />
        <div className="mt-12 grid gap-10 sm:grid-cols-2">
          {team.map((m) => (
            <Reveal key={m.name} className="flex gap-6">
              <div className="relative size-32 shrink-0 overflow-hidden rounded-full sm:size-40">
                <Image src={m.image} alt={m.name} fill sizes="160px" className="object-cover" />
              </div>
              <div>
                <h3 className="text-3xl">{m.name}</h3>
                <p className="text-sm uppercase tracking-widest text-terracotta">{m.role}</p>
                <p className="mt-3 text-sm text-muted-foreground">{m.bio}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>
      <ContactBlock />
    </>
  );
}
