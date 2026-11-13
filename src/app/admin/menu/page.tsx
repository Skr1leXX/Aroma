import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { MenuTable } from "@/components/admin/menu-table";
import { buttonVariants } from "@/components/ui/button";
import { assertAdmin } from "@/lib/session";
import { getCategories, getDishes } from "@/services/catalog";

export const metadata: Metadata = { title: "Меню" };

export default async function AdminMenuPage() {
  await assertAdmin();
  const [dishes, categories] = await Promise.all([getDishes({ includeHidden: true }), getCategories()]);
  return (
    <>
      <div className="mb-6 flex justify-end">
        <Link href="/admin/menu/new" className={buttonVariants()}><Plus /> Добавить блюдо</Link>
      </div>
      <MenuTable initial={dishes} categories={categories} />
    </>
  );
}
