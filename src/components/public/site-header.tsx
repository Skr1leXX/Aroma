"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { buttonVariants } from "@/components/ui/button";
import { publicNav } from "@/config/site";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { data: session } = authClient.useSession();
  const accountHref = session ? "/account" : "/login";
  const accountLabel = session ? "Кабинет" : "Войти";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Pages without a dark hero (dish detail, reservation) need a solid bar from the start.
  const solid = scrolled || open || pathname.startsWith("/menu/") || pathname.startsWith("/reservation") || ["/login", "/register", "/forgot-password", "/reset-password", "/account"].includes(pathname);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-500",
        solid ? "bg-background/95 text-foreground shadow-sm backdrop-blur" : "text-background",
      )}
    >
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-5">
        <Logo />
        <nav aria-label="Основная навигация" className="hidden items-center gap-8 md:flex">
          {publicNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={cn(
                "text-sm tracking-wide transition-colors hover:text-terracotta",
                isActive(item.href) && "underline decoration-terracotta decoration-2 underline-offset-8",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <Link href={accountHref} className="hidden text-sm tracking-wide hover:text-terracotta md:block">
            {accountLabel}
          </Link>
          <Link
            href="/reservation"
            className={cn(
              buttonVariants({ size: "lg" }),
              "hidden bg-terracotta text-white hover:bg-terracotta/90 sm:inline-flex",
            )}
          >
            Забронировать
          </Link>
          <button
            type="button"
            aria-label={open ? "Закрыть меню" : "Открыть меню"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="grid size-10 place-items-center md:hidden"
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      {open && (
        <nav aria-label="Мобильная навигация" className="border-t border-border bg-background px-5 pb-8 pt-4 md:hidden">
          <ul className="flex flex-col">
            {publicNav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} onClick={() => setOpen(false)} className="block border-b border-border py-4 font-heading text-2xl">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <Link href={accountHref} onClick={() => setOpen(false)} className="mt-4 block py-2 text-sm text-muted-foreground">
            {accountLabel}
          </Link>
          <Link
            href="/reservation"
            onClick={() => setOpen(false)}
            className={cn(buttonVariants({ size: "lg" }), "mt-6 w-full bg-terracotta text-white hover:bg-terracotta/90")}
          >
            Забронировать стол
          </Link>
        </nav>
      )}
    </header>
  );
}
