"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { createCategory, deleteCategory, moveCategory, updateCategory } from "@/actions/admin";
import { Field, FormStatus } from "@/components/public/form-parts";
import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ActionState, Category } from "@/types";

const initial: ActionState = { ok: false };

function CategoryRow({
  category, count, first, last, onOp,
}: { category: Category; count: number; first: boolean; last: boolean; onOp: (job: () => Promise<{ ok: boolean; message?: string }>) => void }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(async (p: ActionState, f: FormData) => {
    const res = await updateCategory(p, f);
    if (res.ok) router.refresh();
    return res;
  }, initial);
  const e = state.errors ?? {};

  return (
    <li className="rounded-xl border border-border bg-card p-5">
      <form action={action} className="grid gap-3 md:grid-cols-[1fr_1fr_2fr_auto] md:items-end">
        <input type="hidden" name="id" value={category.id} />
        <Field name={`name-${category.id}`} label="Название" errors={e.name}><Input name="name" defaultValue={category.name} /></Field>
        <Field name={`slug-${category.id}`} label="Slug" errors={e.slug}><Input name="slug" defaultValue={category.slug} /></Field>
        <Field name={`desc-${category.id}`} label="Описание" errors={e.description}><Input name="description" defaultValue={category.description} /></Field>
        <Button type="submit" disabled={pending}>Сохранить</Button>
      </form>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-terracotta">{count} блюд</p>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" aria-label="Выше" disabled={first} onClick={() => onOp(() => moveCategory(category.id, "up"))}><ArrowUp /></Button>
          <Button size="icon" variant="ghost" aria-label="Ниже" disabled={last} onClick={() => onOp(() => moveCategory(category.id, "down"))}><ArrowDown /></Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Удалить ${category.name}`}
            disabled={count > 0}
            title={count > 0 ? "Нельзя удалить: в категории есть блюда" : "Удалить"}
            onClick={() => confirm(`Удалить категорию «${category.name}»?`) && onOp(() => deleteCategory(category.id))}
          >
            <Trash2 />
          </Button>
        </div>
      </div>
      <FormStatus state={state} />
    </li>
  );
}

export function CategoryManager({ categories, counts }: { categories: Category[]; counts: Record<string, number> }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [, start] = useTransition();
  const onOp = (job: () => Promise<{ ok: boolean; message?: string }>) =>
    start(async () => {
      const res = await job();
      setError(res.ok ? "" : (res.message ?? "Ошибка"));
      if (res.ok) router.refresh();
    });

  const [state, action, pending] = useActionState(async (p: ActionState, f: FormData) => {
    const res = await createCategory(p, f);
    if (res.ok) router.refresh();
    return res;
  }, initial);
  const e = state.errors ?? {};

  return (
    <div className="space-y-10">
      <form action={action} className="grid max-w-4xl gap-4 rounded-xl border border-border bg-card p-6 md:grid-cols-[1fr_1fr_2fr_auto] md:items-end">
        <Field name="name" label="Новая категория" errors={e.name}><Input id="name" name="name" /></Field>
        <Field name="slug" label="Slug (необязательно)" errors={e.slug}><Input id="slug" name="slug" placeholder="из названия" /></Field>
        <Field name="description" label="Описание" errors={e.description}><Input id="description" name="description" /></Field>
        <Button type="submit" disabled={pending}>Добавить</Button>
        <div className="md:col-span-4"><FormStatus state={state} /></div>
      </form>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {categories.length === 0 ? (
        <EmptyState title="Категорий пока нет" text="Создайте первую, чтобы добавлять блюда." />
      ) : (
        <ul className="max-w-4xl space-y-4">
          {categories.map((c, i) => (
            <CategoryRow key={c.id} category={c} count={counts[c.id] ?? 0} first={i === 0} last={i === categories.length - 1} onOp={onOp} />
          ))}
        </ul>
      )}
    </div>
  );
}
