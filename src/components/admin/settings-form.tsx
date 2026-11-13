"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { updateSettings } from "@/actions/admin";
import { Field, FormStatus } from "@/components/public/form-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { dayNames, type BookingRules } from "@/config/booking";
import type { Settings } from "@/services/catalog";

const num = (name: string, label: string, value: number, errors?: string[], hint?: string) => (
  <Field name={name} label={label} errors={errors}>
    <Input id={name} name={name} type="number" defaultValue={value} />
    {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
  </Field>
);

export function SettingsForm({ settings, rules }: { settings: Settings; rules: BookingRules }) {
  const [state, action, pending] = useActionState(updateSettings, { ok: false });
  const e = state.errors ?? {};

  return (
    <form action={action} className="max-w-2xl space-y-10">
      <section className="space-y-5">
        <h2 className="text-3xl">О ресторане</h2>
        <Field name="name" label="Название" errors={e.name}><Input id="name" name="name" defaultValue={settings.name} /></Field>
        <Field name="description" label="Описание (подвал сайта)" errors={e.description}><Textarea id="description" name="description" rows={3} defaultValue={settings.description} /></Field>
        <Field name="address" label="Адрес" errors={e.address}><Input id="address" name="address" defaultValue={settings.address} /></Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field name="phone" label="Телефон" errors={e.phone}><Input id="phone" name="phone" defaultValue={settings.phone} /></Field>
          <Field name="email" label="Email" errors={e.email}><Input id="email" name="email" defaultValue={settings.email} /></Field>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-3xl">Социальные сети</h2>
        <p className="text-sm text-muted-foreground">До четырёх ссылок, только https://. Пустые строки игнорируются.</p>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="grid grid-cols-[1fr_2fr] gap-3">
            <Input aria-label={`Соцсеть ${i + 1}: название`} name={`socialLabel${i}`} placeholder="Instagram" defaultValue={settings.social[i]?.label ?? ""} />
            <Input aria-label={`Соцсеть ${i + 1}: ссылка`} name={`socialHref${i}`} placeholder="https://" defaultValue={settings.social[i]?.href ?? ""} />
          </div>
        ))}
        {e.social && <p className="text-sm text-destructive">Проверьте ссылки: нужен полный адрес с https://</p>}
      </section>

      <section className="space-y-3">
        <h2 className="text-3xl">График работы</h2>
        <p className="text-sm text-muted-foreground">Если «закрытие» не позже «открытия», ресторан работает после полуночи (например, 12:00 – 01:00).</p>
        {rules.schedule.map((d, i) => (
          <div key={i} className="grid grid-cols-[3rem_1fr_1fr_auto] items-center gap-3">
            <span className="text-sm font-medium">{dayNames[i]}</span>
            <Input aria-label={`${dayNames[i]}: открытие`} name={`open${i}`} type="time" defaultValue={d?.open ?? "12:00"} />
            <Input aria-label={`${dayNames[i]}: закрытие`} name={`close${i}`} type="time" defaultValue={d?.close ?? "23:00"} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name={`closed${i}`} defaultChecked={!d} /> выходной</label>
          </div>
        ))}
        {e.schedule && <p className="text-sm text-destructive">Проверьте время работы</p>}
      </section>

      <section className="space-y-5">
        <h2 className="text-3xl">Правила бронирования</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          {num("reservationDurationMinutes", "Длительность брони, мин", rules.durationMinutes, e.reservationDurationMinutes)}
          {num("slotIntervalMinutes", "Шаг времени, мин", rules.slotIntervalMinutes, e.slotIntervalMinutes)}
          {num("seatingCapacity", "Мест в зале одновременно", rules.seatingCapacity, e.seatingCapacity)}
          {num("maxConcurrentReservations", "Броней одновременно", rules.maxConcurrent, e.maxConcurrentReservations, "Столов / компаний в один момент")}
          {num("maxPartySize", "Макс. гостей в брони", rules.maxPartySize, e.maxPartySize)}
          {num("minNoticeMinutes", "Минимум до визита, мин", rules.minNoticeMinutes, e.minNoticeMinutes)}
          {num("bookingHorizonDays", "Бронь не дальше, дней", rules.horizonDays, e.bookingHorizonDays)}
        </div>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="autoConfirm" value="true" defaultChecked={rules.autoConfirm} className="mt-1" />
          <span>Подтверждать брони автоматически<br /><span className="text-muted-foreground">Выключено: каждая заявка ждёт ручного подтверждения.</span></span>
        </label>
      </section>

      <div className="space-y-3">
        <FormStatus state={state} />
        <Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />} Сохранить</Button>
      </div>
    </form>
  );
}
