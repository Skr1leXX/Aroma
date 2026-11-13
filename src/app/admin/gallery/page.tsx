import type { Metadata } from "next";
import { GalleryManager } from "@/components/admin/gallery-manager";
import { getGallery } from "@/services/catalog";

export const metadata: Metadata = { title: "Галерея" };

export default async function AdminGalleryPage() {
  return <GalleryManager images={await getGallery({ all: true })} />;
}
