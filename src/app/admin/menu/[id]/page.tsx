import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DishForm } from "@/components/admin/dish-form";
import { DishImages } from "@/components/admin/dish-images";
import { assertAdmin } from "@/lib/session";
import { uuid } from "@/lib/validations";
import { getMenuItemForEdit } from "@/services/admin";
import { getCategories } from "@/services/catalog";

export const metadata: Metadata = { title: "Редактирование блюда" };

export default async function EditDishPage({ params }: { params: Promise<{ id: string }> }) {
  await assertAdmin();
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const [data, categories] = await Promise.all([getMenuItemForEdit(id), getCategories()]);
  if (!data) notFound();
  const { item, images } = data;

  return (
    <div className="space-y-12">
      <Link href="/admin/menu" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-terracotta"><ArrowLeft className="size-4" /> К меню</Link>
      <DishForm
        categories={categories}
        dish={{
          id: item.id, name: item.name, slug: item.slug, description: item.description, categoryId: item.categoryId,
          price: Number(item.price), weight: item.weight, ingredients: item.ingredients, allergens: item.allergens,
          isPopular: item.isPopular, isAvailable: item.isAvailable,
        }}
      />
      <DishImages menuItemId={item.id} images={images.map((i) => ({ id: i.id, url: i.url, isPrimary: i.isPrimary }))} />
    </div>
  );
}
