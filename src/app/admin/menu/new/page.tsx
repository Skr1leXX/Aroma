import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DishForm } from "@/components/admin/dish-form";
import { assertAdmin } from "@/lib/session";
import { getCategories } from "@/services/catalog";

export const metadata: Metadata = { title: "Новое блюдо" };

export default async function NewDishPage() {
  await assertAdmin();
  const categories = await getCategories();
  return (
    <div className="space-y-8">
      <Link href="/admin/menu" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-terracotta"><ArrowLeft className="size-4" /> К меню</Link>
      {categories.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-sm">Сначала создайте хотя бы одну <Link className="underline" href="/admin/categories">категорию</Link>.</p>
      ) : (
        <DishForm categories={categories} />
      )}
    </div>
  );
}
