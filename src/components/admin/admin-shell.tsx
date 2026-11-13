"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  CalendarDays, ExternalLink, History, ImageIcon, LayoutDashboard, Menu, MessageSquare, Settings, Tags, Utensils, X,
} from "lucide-react";
import { SignOutButton } from "@/components/public/sign-out-button";
import { Logo } from "@/components/shared/logo";
import { adminNav } from "@/config/site";
import { cn } from "@/lib/utils";

const icons = {
  layout: LayoutDashboard, calendar: CalendarDays, utensils: Utensils,
  tags: Tags, message: MessageSquare, image: ImageIcon, settings: Settings, history: History,
};

export function AdminShell({ children, email }: { children: ReactNode; email: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const current = adminNav.find((n) => (n.href === "/admin" ? pathname === n.href : pathname.startsWith(n.href)));

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[16rem_1fr]">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-sidebar p-6 text-sidebar-foreground transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <Logo href="/admin" className="text-sidebar-accent-foreground" />
        <p className="mt-1 text-xs uppercase tracking-widest text-sidebar-foreground/60">Панель управления</p>
        <nav aria-label="Админ-навигация" className="mt-10 space-y-1">
          {adminNav.map((n) => {
            const Icon = icons[n.icon];
            const active = n === current;
            return (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-sidebar-accent",
                  active && "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary",
                )}
              >
                <Icon className="size-4" /> {n.label}
              </Link>
            );
          })}
        </nav>
        <Link href="/" className="mt-10 flex items-center gap-2 text-xs text-sidebar-foreground/70 hover:text-sidebar-foreground">
          <ExternalLink className="size-3" /> Открыть сайт
        </Link>
      </aside>
      {open && <button aria-label="Закрыть меню" className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-border bg-background/90 px-5 backdrop-blur lg:px-10">
          <button className="lg:hidden" aria-label={open ? "Закрыть меню" : "Открыть меню"} onClick={() => setOpen((v) => !v)}>
            {open ? <X /> : <Menu />}
          </button>
          <h1 className="text-2xl">{current?.label}</h1>
          <span className="ml-auto hidden text-xs text-muted-foreground sm:block">{email}</span>
          <SignOutButton className="ml-auto sm:ml-0" />
        </header>
        <main className="p-5 lg:p-10">{children}</main>
      </div>
    </div>
  );
}
