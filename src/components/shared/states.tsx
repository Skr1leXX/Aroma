import type { ReactNode } from "react";
import { AlertTriangle, Inbox, Loader2 } from "lucide-react";

function StateBox({ icon, title, text, children }: { icon: ReactNode; title: string; text?: string; children?: ReactNode }) {
  return (
    <div
      role="status"
      className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-14 text-center"
    >
      <div className="text-terracotta">{icon}</div>
      <h3 className="text-2xl">{title}</h3>
      {text && <p className="text-sm text-muted-foreground">{text}</p>}
      {children}
    </div>
  );
}

export const EmptyState = ({ title = "Здесь пока пусто", text, children }: { title?: string; text?: string; children?: ReactNode }) => (
  <StateBox icon={<Inbox className="size-8" />} title={title} text={text}>
    {children}
  </StateBox>
);

export const ErrorState = ({ title = "Что-то пошло не так", text, children }: { title?: string; text?: string; children?: ReactNode }) => (
  <StateBox icon={<AlertTriangle className="size-8" />} title={title} text={text}>
    {children}
  </StateBox>
);

export const LoadingState = ({ label = "Загружаем…" }: { label?: string }) => (
  <div role="status" aria-live="polite" className="flex items-center justify-center gap-3 py-24 text-muted-foreground">
    <Loader2 className="size-5 animate-spin" /> {label}
  </div>
);
