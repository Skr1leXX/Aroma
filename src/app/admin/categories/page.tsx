import type { Metadata } from "next";
import { CategoryManager } from "@/components/admin/category-manager";
import { assertAdmin } from "@/lib/session";
import { getCategories, getDishes } from "@/services/catalog";

export const metadata: Metadata = { title: "Категории" };

export default async function CategoriesPage() {
  await assertAdmin();
  const [categories, dishes] = await Promise.all([getCategories(), getDishes({ includeHidden: true })]);
  const counts: Record<string, number> = {};
  for (const d of dishes) counts[d.categoryId] = (counts[d.categoryId] ?? 0) + 1;
  return <CategoryManager categories={categories} counts={counts} />;
}
