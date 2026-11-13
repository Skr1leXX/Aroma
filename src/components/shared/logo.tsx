import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link
      href={href}
      aria-label="Aroma — на главную"
      className={cn("font-heading text-2xl font-semibold tracking-[0.35em] uppercase", className)}
    >
      Aroma<span className="text-terracotta">.</span>
    </Link>
  );
}
