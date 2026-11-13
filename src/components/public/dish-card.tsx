import Image from "next/image";
import Link from "next/link";
import { Flame } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import type { Dish } from "@/types";

export function DishCard({ dish, priority = false }: { dish: Dish; priority?: boolean }) {
  return (
    <Link href={`/menu/${dish.slug}`} className="group block">
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-secondary">
        <Image
          src={dish.image}
          alt={dish.name}
          fill
          priority={priority}
          sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw"
          className="object-cover transition-transform duration-700 group-hover:scale-105"
        />
        {dish.popular && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-terracotta px-3 py-1 text-xs font-medium text-white">
            <Flame className="size-3" /> Популярное
          </span>
        )}
        {!dish.available && (
          <span className="absolute inset-0 grid place-items-center bg-espresso/60 text-sm font-medium uppercase tracking-widest text-white">
            Временно нет
          </span>
        )}
      </div>
      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-2xl leading-tight transition-colors group-hover:text-terracotta">{dish.name}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{dish.description}</p>
        </div>
        <p className="whitespace-nowrap font-heading text-xl font-semibold">{formatPrice(dish.price)}</p>
      </div>
    </Link>
  );
}
