"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2, RefreshCw, Star, Trash2, Upload } from "lucide-react";
import { moveMenuImage, setPrimaryMenuImage } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ACCEPT, checkFile, imageApi } from "@/lib/image-api";

type Img = { id: string; url: string; isPrimary: boolean };

export function DishImages({ menuItemId, images }: { menuItemId: string; images: Img[] }) {
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

  const upload = (file: File | undefined, extra: (fd: FormData) => void, key: string, method: "POST" | "PUT") => {
    const problem = checkFile(file);
    if (problem || !file) return setError(problem ?? "");
    const fd = new FormData();
    fd.set("target", "menu-item");
    fd.set("file", file);
    extra(fd);
    return run(key, () => imageApi(method, fd));
  };

  return (
    <section className="max-w-3xl">
      <h2 className="mb-4 text-3xl">Фотографии</h2>
      <label className="mb-6 flex flex-wrap items-center gap-3 text-sm">
        <Input type="file" accept={ACCEPT} className="max-w-xs" aria-label="Добавить фото" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; void upload(f, (fd) => fd.set("menuItemId", menuItemId), "new", "POST"); }} />
        {busy === "new" ? <Loader2 className="animate-spin" /> : <Upload className="size-4 text-muted-foreground" />}
      </label>
      {error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}
      <input ref={replaceRef} type="file" hidden accept={ACCEPT} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; const id = replaceId.current; void upload(f, (fd) => fd.set("id", id), id, "PUT"); }} />

      {images.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Фотографий пока нет. На сайте будет заглушка.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {images.map((img, i) => (
            <li key={img.id} className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="relative aspect-square">
                <Image src={img.url} alt="" fill sizes="200px" className="object-cover" />
                {img.isPrimary && <span className="absolute left-2 top-2 rounded-full bg-terracotta px-2 py-0.5 text-xs text-white">Главное</span>}
                {busy === img.id && <div className="absolute inset-0 grid place-items-center bg-background/70"><Loader2 className="animate-spin" /></div>}
              </div>
              <div className="flex justify-between p-1">
                <Button size="icon" variant="ghost" aria-label="Сделать главным" disabled={img.isPrimary} onClick={() => run(img.id, () => setPrimaryMenuImage(img.id))}><Star /></Button>
                <Button size="icon" variant="ghost" aria-label="Сдвинуть влево" disabled={i === 0} onClick={() => run(img.id, () => moveMenuImage(img.id, "up"))}><ArrowLeft /></Button>
                <Button size="icon" variant="ghost" aria-label="Сдвинуть вправо" disabled={i === images.length - 1} onClick={() => run(img.id, () => moveMenuImage(img.id, "down"))}><ArrowRight /></Button>
                <Button size="icon" variant="ghost" aria-label="Заменить файл" onClick={() => { replaceId.current = img.id; replaceRef.current?.click(); }}><RefreshCw /></Button>
                <Button size="icon" variant="ghost" aria-label="Удалить фото" onClick={() => confirm("Удалить фото?") && run(img.id, () => imageApi("DELETE", undefined, `?target=menu-item&id=${img.id}`))}><Trash2 /></Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
