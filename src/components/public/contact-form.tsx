"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { sendContactMessage } from "@/actions/forms";
import { Field, FormStatus } from "@/components/public/form-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ActionState } from "@/types";

const initial: ActionState = { ok: false };

export function ContactForm() {
  const [state, action, pending] = useActionState(sendContactMessage, initial);
  const e = state.errors ?? {};
  const v = state.values ?? {};

  return (
    <form action={action} noValidate className="space-y-5">
      <Field name="name" label="Имя" errors={e.name}>
        <Input id="name" name="name" autoComplete="name" defaultValue={v.name} aria-invalid={!!e.name} />
      </Field>
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="phone" label="Телефон" errors={e.phone}>
          <Input id="phone" name="phone" type="tel" autoComplete="tel" defaultValue={v.phone} aria-invalid={!!e.phone} />
        </Field>
        <Field name="email" label="Email" errors={e.email}>
          <Input id="email" name="email" type="email" autoComplete="email" defaultValue={v.email} aria-invalid={!!e.email} />
        </Field>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">Достаточно указать телефон или email.</p>
      <Field name="message" label="Сообщение" errors={e.message}>
        <Textarea id="message" name="message" rows={5} defaultValue={v.message} aria-invalid={!!e.message} />
      </Field>
      <FormStatus state={state} />
      <Button type="submit" size="lg" disabled={pending} className="bg-espresso text-background hover:bg-espresso/90">
        {pending && <Loader2 className="animate-spin" />} {pending ? "Отправляем…" : "Отправить"}
      </Button>
    </form>
  );
}
