import type { ReactNode } from "react";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { Label } from "@/components/ui/label";
import type { ActionState } from "@/types";

export function Field({
  name,
  label,
  errors,
  children,
}: {
  name: string;
  label: string;
  errors?: string[];
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      {children}
      {errors?.[0] && (
        <p id={`${name}-error`} className="text-sm text-destructive">
          {errors[0]}
        </p>
      )}
    </div>
  );
}

export function FormStatus({ state }: { state: ActionState }) {
  if (!state.message) return null;
  const Icon = state.ok ? CheckCircle2 : CircleAlert;
  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={`flex items-start gap-2 rounded-lg p-4 text-sm ${
        state.ok ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-900"
      }`}
    >
      <Icon className="mt-0.5 size-4 shrink-0" /> {state.message}
    </p>
  );
}

/** Native <select> styled like <Input>: reliable inside plain form submissions and on mobile. */
export const selectClass =
  "h-11 w-full rounded-lg border border-input bg-card px-3 sm:h-10 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";
