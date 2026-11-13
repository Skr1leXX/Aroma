import Link from "next/link";
import { EmptyState } from "@/components/shared/states";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="px-5 pt-40 pb-24">
      <EmptyState title="Страница не найдена" text="Возможно, блюдо убрали из меню или ссылка устарела.">
        <Link href="/menu" className={buttonVariants()}>Перейти в меню</Link>
      </EmptyState>
    </div>
  );
}
