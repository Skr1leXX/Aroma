import type { ReactNode } from "react";

export function AuthCard({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-md px-5 pb-24 pt-36">
      <h1 className="text-5xl">{title}</h1>
      {description && <p className="mt-3 text-muted-foreground">{description}</p>}
      <div className="mt-8 rounded-2xl border border-border bg-card p-6 sm:p-8">{children}</div>
    </div>
  );
}
