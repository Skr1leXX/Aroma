import Link from "next/link";
import { EmptyState } from "@/components/shared/states";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="px-5 py-32">
      <EmptyState title="Страница не найдена" text="Проверьте адрес или вернитесь на главную.">
        <Link href="/" className={buttonVariants()}>На главную</Link>
      </EmptyState>
    </div>
  );
}
