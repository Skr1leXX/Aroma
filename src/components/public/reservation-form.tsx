"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { createReservation } from "@/actions/forms";
import { Field, FormStatus, selectClass } from "@/components/public/form-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ActionState } from "@/types";

type Slot = { time: string; available: boolean };
type Loaded = { key: string; slots?: Slot[]; error?: string };

const initial: ActionState = { ok: false };

export function ReservationForm({
  idempotencyKey, minDate, maxDate, maxGuests,
}: {
  idempotencyKey: string; // generated per page render on the server; makes a double submit harmless
  minDate: string;
  maxDate: string;
  maxGuests: number;
}) {
  const [state, action, pending] = useActionState(createReservation, initial);
  const e = state.errors ?? {};
  const v = state.values ?? {};

  const [date, setDate] = useState(v.date ?? "");
  const [guests, setGuests] = useState(v.guests ?? "2");
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const key = date && guests ? `${date}|${guests}` : "";

  // Offered times come from the server; refetched after each rejected submit so stale slots disappear.
  const refreshToken = state.message;
  useEffect(() => {
    if (!key) return;
    const ctrl = new AbortController();
    fetch(`/api/reservations/availability?date=${date}&guests=${guests}`, { signal: ctrl.signal, cache: "no-store" })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok || j.ok === false) return setLoaded({ key, error: j.message ?? j.error ?? "Не удалось загрузить время" });
        setLoaded({ key, slots: j.slots });
      })
      .catch((err) => err.name !== "AbortError" && setLoaded({ key, error: "Не удалось загрузить доступное время. Проверьте соединение." }));
    return () => ctrl.abort();
  }, [key, date, guests, refreshToken]);

  const current = loaded?.key === key ? loaded : null;
  const loading = !!key && !current;
  const free = current?.slots?.filter((s) => s.available).length ?? 0;

  return (
    <form action={action} noValidate className="grid gap-5 sm:grid-cols-2">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      {/* Honeypot: hidden from people, tempting to bots */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>

      <Field name="name" label="Имя" errors={e.name}>
        <Input id="name" name="name" autoComplete="name" defaultValue={v.name} aria-invalid={!!e.name} />
      </Field>
      <Field name="phone" label="Телефон" errors={e.phone}>
        <Input id="phone" name="phone" type="tel" autoComplete="tel" placeholder="+7" defaultValue={v.phone} aria-invalid={!!e.phone} />
      </Field>
      <div className="sm:col-span-2">
        <Field name="email" label="Email" errors={e.email}>
          <Input id="email" name="email" type="email" autoComplete="email" defaultValue={v.email} aria-invalid={!!e.email} />
        </Field>
      </div>
      <Field name="date" label="Дата" errors={e.date}>
        <Input id="date" name="date" type="date" min={minDate} max={maxDate} value={date} onChange={(ev) => setDate(ev.target.value)} aria-invalid={!!e.date} />
      </Field>
      <Field name="guests" label="Количество гостей" errors={e.guests}>
        <select id="guests" name="guests" value={guests} onChange={(ev) => setGuests(ev.target.value)} className={selectClass}>
          {Array.from({ length: maxGuests }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </Field>

      <div className="sm:col-span-2">
        <Field name="time" label="Время" errors={e.time}>
          {!key ? (
            <p className="text-sm text-muted-foreground">Выберите дату — покажем свободное время.</p>
          ) : loading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Проверяем свободные столы…</p>
          ) : current?.error ? (
            <p role="alert" className="text-sm text-destructive">{current.error}</p>
          ) : free === 0 ? (
            <p role="status" className="text-sm text-destructive">На эту дату свободного времени нет. Выберите другой день.</p>
          ) : (
            <div role="radiogroup" aria-label="Время" className="flex flex-wrap gap-2">
              {current!.slots!.map((s) => (
                <label key={s.time} className={s.available ? "cursor-pointer" : "cursor-not-allowed opacity-40"}>
                  <input type="radio" name="time" value={s.time} disabled={!s.available} defaultChecked={v.time === s.time && s.available} className="peer sr-only" />
                  <span className="block rounded-lg border border-input px-4 py-2 text-sm transition-colors peer-checked:border-espresso peer-checked:bg-espresso peer-checked:text-background peer-focus-visible:ring-3 peer-focus-visible:ring-ring/40">
                    {s.time}
                  </span>
                </label>
              ))}
            </div>
          )}
        </Field>
      </div>

      <div className="sm:col-span-2">
        <Field name="comment" label="Комментарий" errors={e.comment}>
          <Textarea id="comment" name="comment" rows={4} placeholder="Повод, детский стул, аллергии…" defaultValue={v.comment} />
        </Field>
      </div>
      <div className="space-y-4 sm:col-span-2">
        <FormStatus state={state} />
        <Button type="submit" size="lg" disabled={pending} className="w-full bg-terracotta text-white hover:bg-terracotta/90 sm:w-auto">
          {pending && <Loader2 className="animate-spin" />} {pending ? "Отправляем…" : "Отправить заявку"}
        </Button>
        <p className="text-xs text-muted-foreground">Заявка получит статус «ожидает подтверждения». Стол закрепляется после звонка администратора.</p>
      </div>
    </form>
  );
}
