import type { Metadata } from "next";
import { GalleryGrid } from "@/components/public/gallery-grid";
import { PageHero } from "@/components/shared/section-heading";
import { getGallery } from "@/services/catalog";

export const metadata: Metadata = { title: "Галерея" };

export default async function GalleryPage() {
  const images = await getGallery();
  return (
    <>
      <PageHero eyebrow="Галерея" title="Aroma в кадрах" description="Блюда, зал и вечера, которые нам особенно дороги." />
      <section className="mx-auto max-w-6xl px-5 py-16">
        <GalleryGrid images={images} />
      </section>
    </>
  );
}
