"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2, RefreshCw, Star, Trash2, Upload } from "lucide-react";
import { moveGalleryImage, setFeaturedGalleryImage } from "@/actions/admin";
import { selectClass } from "@/components/public/form-parts";
import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ACCEPT, checkFile, imageApi } from "@/lib/image-api";
import type { GalleryImage } from "@/types";

const groups = [
  ["dishes", "Блюда"], ["interior", "Интерьер"], ["events", "Мероприятия"], ["restaurant", "Ресторан"], ["team", "Команда"],
] as const;

type Item = GalleryImage;

export function GalleryManager({ images }: { images: Item[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const replaceRef = useRef<HTMLInputElement>(null);
  const replaceId = useRef("");

  async function run(key: string, job: () => Promise<{ ok?: boolean; message?: string } | void>) {
    setBusy(key);
    setError("");
    try {
      const res = await job();
      if (res && res.ok === false) throw new Error(res.message ?? "Ошибка");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-10">
      <form
        className="grid gap-4 rounded-xl border border-border bg-card p-6 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const data = new FormData(form);
          const problem = checkFile(data.get("file") as File | null);
          if (problem) return setError(problem);
          data.set("target", "gallery");
          void run("new", async () => {
            await imageApi("POST", data);
            form.reset();
          });
        }}
      >
        <label className="space-y-2 text-sm">Фото
          <Input name="file" type="file" accept={ACCEPT} required />
        </label>
        <label className="space-y-2 text-sm">Описание (alt)
          <Input name="alt" required minLength={2} maxLength={200} />
        </label>
        <label className="space-y-2 text-sm">Раздел
          <select name="group" className={selectClass} defaultValue="dishes">
            {groups.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <Button type="submit" disabled={busy === "new"}>
          {busy === "new" ? <Loader2 className="animate-spin" /> : <Upload />} Загрузить
        </Button>
      </form>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <input
        ref={replaceRef}
        type="file"
        hidden
        accept={ACCEPT}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          const problem = checkFile(file);
          if (problem || !file) return setError(problem ?? "");
          const id = replaceId.current;
          const data = new FormData();
          data.set("target", "gallery");
          data.set("id", id);
          data.set("file", file);
          void run(id, () => imageApi("PUT", data));
        }}
      />

      {images.length === 0 ? (
        <EmptyState title="Фотографий пока нет" text="Загрузите первое фото выше." />
      ) : (
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {images.map((i, idx) => (
            <li key={i.id} className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="relative aspect-square">
                <Image src={i.src} alt={i.alt} fill sizes="(min-width:1280px) 20vw, 40vw" className="object-cover" />
                {i.featured && <span className="absolute left-2 top-2 rounded-full bg-terracotta px-2 py-0.5 text-xs text-white">Главное</span>}
                {busy === i.id && <div className="absolute inset-0 grid place-items-center bg-background/70"><Loader2 className="animate-spin" /></div>}
              </div>
              <p className="truncate px-3 pt-2 text-xs">{i.alt} <span className="text-muted-foreground">· {groups.find((g) => g[0] === i.group)?.[1]}</span></p>
              <div className="flex justify-between p-1">
                <Button size="icon" variant="ghost" aria-label="Сделать главным" disabled={i.featured} onClick={() => run(i.id, () => setFeaturedGalleryImage(i.id))}><Star /></Button>
                <Button size="icon" variant="ghost" aria-label="Сдвинуть назад" disabled={idx === 0} onClick={() => run(i.id, () => moveGalleryImage(i.id, "up"))}><ArrowLeft /></Button>
                <Button size="icon" variant="ghost" aria-label="Сдвинуть вперёд" disabled={idx === images.length - 1} onClick={() => run(i.id, () => moveGalleryImage(i.id, "down"))}><ArrowRight /></Button>
                <Button size="icon" variant="ghost" aria-label="Заменить фото" onClick={() => { replaceId.current = i.id; replaceRef.current?.click(); }}><RefreshCw /></Button>
                <Button size="icon" variant="ghost" aria-label="Удалить фото" onClick={() => confirm("Удалить фото?") && run(i.id, () => imageApi("DELETE", undefined, `?target=gallery&id=${i.id}`))}><Trash2 /></Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
