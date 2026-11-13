"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { rescheduleReservation, saveReservationNote, setReservationStatus } from "@/actions/admin";
import { Field, FormStatus } from "@/components/public/form-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ActionState, ReservationStatus } from "@/types";

const initial: ActionState = { ok: false };

export function BookingActions({
  id, status, date, time, note,
}: { id: string; status: ReservationStatus; date: string; time: string; note: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const change = (next: "confirmed" | "rejected" | "cancelled", ask?: string) => {
    if (ask && !confirm(ask)) return;
    start(async () => {
      const res = await setReservationStatus(id, next);
      setError(res.ok ? "" : (res.message ?? "Ошибка"));
      if (res.ok) router.refresh();
    });
  };

  const [moveState, moveAction, moving] = useActionState(async (p: ActionState, f: FormData) => {
    const res = await rescheduleReservation(p, f);
    if (res.ok) router.refresh();
    return res;
  }, initial);
  const [noteState, noteAction, saving] = useActionState(saveReservationNote, initial);
  const active = status === "pending" || status === "confirmed";

  return (
    <div className="space-y-10">
      <section>
        <h2 className="mb-3 text-2xl">Статус</h2>
        <div className="flex flex-wrap gap-2">
          {status === "pending" && <Button disabled={pending} onClick={() => change("confirmed")}>Подтвердить</Button>}
          {status === "pending" && <Button disabled={pending} variant="outline" onClick={() => change("rejected", "Отклонить заявку?")}>Отклонить</Button>}
          {status === "confirmed" && <Button disabled={pending} variant="outline" onClick={() => change("cancelled", "Отменить подтверждённую бронь?")}>Отменить бронь</Button>}
          {!active && <p className="text-sm text-muted-foreground">Бронь закрыта — статус изменить нельзя.</p>}
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
      </section>

      {active && (
        <section>
          <h2 className="mb-3 text-2xl">Изменить дату и время</h2>
          <form action={moveAction} className="grid max-w-xl gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <input type="hidden" name="id" value={id} />
            <Field name="date" label="Дата" errors={moveState.errors?.date}><Input id="date" name="date" type="date" defaultValue={date} /></Field>
            <Field name="time" label="Время" errors={moveState.errors?.time}><Input id="time" name="time" type="time" defaultValue={time} /></Field>
            <Button type="submit" disabled={moving}>{moving && <Loader2 className="animate-spin" />} Перенести</Button>
          </form>
          <div className="mt-3 max-w-xl"><FormStatus state={moveState} /></div>
          <p className="mt-2 text-xs text-muted-foreground">Проверяются график работы и вместимость так же, как при онлайн-брони.</p>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-2xl">Комментарий администратора</h2>
        <form action={noteAction} className="max-w-xl space-y-3">
          <input type="hidden" name="id" value={id} />
          <Textarea name="note" rows={4} defaultValue={note} maxLength={1000} aria-label="Комментарий администратора" placeholder="Видно только сотрудникам" />
          <FormStatus state={noteState} />
          <Button type="submit" variant="outline" disabled={saving}>Сохранить комментарий</Button>
        </form>
      </section>
    </div>
  );
}
