"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createMenuItem, updateMenuItem } from "@/actions/admin";
import { Field, FormStatus, selectClass } from "@/components/public/form-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ACCEPT, checkFile, imageApi } from "@/lib/image-api";
import type { ActionState, Category } from "@/types";

type Initial = {
  id: string; name: string; slug: string; description: string; categoryId: string; price: number; weight: string;
  ingredients: string[]; allergens: string[]; isPopular: boolean; isAvailable: boolean;
};

/** Create (no `dish`) or edit (with `dish`). Photos of an existing dish are managed by <DishImages/>. */
export function DishForm({ categories, dish }: { categories: Category[]; dish?: Initial }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(async (_: ActionState, form: FormData): Promise<ActionState> => {
    if (dish) {
      form.set("id", dish.id);
      const res = await updateMenuItem(_, form);
      if (res.ok) router.refresh();
      return res;
    }
    const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    form.delete("files");
    for (const f of files) {
      const problem = checkFile(f);
      if (problem) return { ok: false, message: `${f.name}: ${problem}`, values: Object.fromEntries([...form].map(([k, v]) => [k, String(v)])) };
    }
    const res = await createMenuItem(_, form);
    if (!res.ok || !res.id) return { ...res, values: Object.fromEntries([...form].map(([k, v]) => [k, String(v)])) };
    try {
      for (const f of files) {
        const up = new FormData();
        up.set("target", "menu-item");
        up.set("menuItemId", res.id);
        up.set("file", f);
        await imageApi("POST", up);
      }
    } catch {
      // dish exists; photos can be added on the edit page
    }
    router.push(`/admin/menu/${res.id}`);
    return res;
  }, { ok: false });

  const e = state.errors ?? {};
  const v = state.values ?? {};
  const val = (k: keyof Initial, fallback = "") => (v[k] ?? (dish ? String(Array.isArray(dish[k]) ? (dish[k] as string[]).join(", ") : dish[k]) : fallback));

  return (
    <form action={action} className="grid max-w-3xl gap-5 md:grid-cols-2">
      <Field name="name" label="Название" errors={e.name}><Input id="name" name="name" defaultValue={val("name")} required /></Field>
      <Field name="slug" label="Slug (необязательно)" errors={e.slug}><Input id="slug" name="slug" defaultValue={val("slug")} placeholder="создастся из названия" /></Field>
      <Field name="categoryId" label="Категория" errors={e.categoryId}>
        <select id="categoryId" name="categoryId" required className={selectClass} defaultValue={val("categoryId")}>
          <option value="" disabled>Выберите</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field name="price" label="Цена, ₽" errors={e.price}><Input id="price" name="price" type="number" min="1" step="1" defaultValue={val("price")} required /></Field>
        <Field name="weight" label="Вес / объём" errors={e.weight}><Input id="weight" name="weight" defaultValue={val("weight")} placeholder="250 г" /></Field>
      </div>
      <div className="md:col-span-2">
        <Field name="description" label="Описание" errors={e.description}><Textarea id="description" name="description" rows={3} defaultValue={val("description")} required minLength={10} /></Field>
      </div>
      <Field name="ingredients" label="Состав (через запятую)" errors={e.ingredients}><Input id="ingredients" name="ingredients" defaultValue={val("ingredients")} /></Field>
      <Field name="allergens" label="Аллергены (через запятую)" errors={e.allergens}><Input id="allergens" name="allergens" defaultValue={val("allergens")} /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isPopular" value="true" defaultChecked={dish?.isPopular ?? v.isPopular === "true"} /> Популярное блюдо</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isAvailable" value="true" defaultChecked={dish ? dish.isAvailable : (v.isAvailable ?? "true") === "true"} /> Показывать в меню</label>
      {!dish && (
        <div className="md:col-span-2">
          <Field name="files" label="Фотографии (JPEG, PNG, WebP, AVIF; до 8 МБ каждая)"><Input id="files" name="files" type="file" multiple accept={ACCEPT} /></Field>
        </div>
      )}
      <div className="space-y-3 md:col-span-2">
        <FormStatus state={state} />
        <Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />} {dish ? "Сохранить" : "Создать блюдо"}</Button>
      </div>
    </form>
  );
}
