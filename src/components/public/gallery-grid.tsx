"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { EmptyState } from "@/components/shared/states";
import { cn } from "@/lib/utils";
import type { GalleryGroup, GalleryImage } from "@/types";

const filters: { value: GalleryGroup | "all"; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "dishes", label: "Блюда" },
  { value: "interior", label: "Интерьер" },
  { value: "events", label: "Мероприятия" },
];

export function GalleryGrid({ images }: { images: GalleryImage[] }) {
  const [filter, setFilter] = useState<GalleryGroup | "all">("all");
  const [active, setActive] = useState<GalleryImage | null>(null);
  const shown = filter === "all" ? images : images.filter((i) => i.group === filter);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setActive(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  return (
    <>
      <div role="tablist" aria-label="Фильтр галереи" className="mb-10 flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.value}
            role="tab"
            aria-selected={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              "rounded-full border px-5 py-2 text-sm transition-colors",
              filter === f.value ? "border-espresso bg-espresso text-background" : "border-border hover:border-terracotta",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyState title="В этой категории пока нет фото" />
      ) : (
        <div className="columns-2 gap-4 lg:columns-3">
          {shown.map((img, i) => (
            <button
              key={img.id}
              onClick={() => setActive(img)}
              aria-label={`Открыть: ${img.alt}`}
              className="group relative mb-4 block w-full overflow-hidden rounded-xl"
            >
              <Image
                src={img.src}
                alt={img.alt}
                width={800}
                height={i % 3 === 0 ? 1000 : 700}
                sizes="(min-width: 1024px) 30vw, 50vw"
                className="h-auto w-full transition-transform duration-700 group-hover:scale-105"
              />
            </button>
          ))}
        </div>
      )}

      {active && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={active.alt}
          className="fixed inset-0 z-[60] grid place-items-center bg-espresso/95 p-4"
          onClick={() => setActive(null)}
        >
          <button aria-label="Закрыть" className="absolute right-5 top-5 text-background" onClick={() => setActive(null)}>
            <X className="size-8" />
          </button>
          <Image
            src={active.src}
            alt={active.alt}
            width={1400}
            height={1000}
            className="max-h-[88vh] w-auto rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
