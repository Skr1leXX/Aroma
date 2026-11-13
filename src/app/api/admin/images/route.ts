import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { getTxDb } from "@/db/transactional";
import { galleryImages, menuItemImages } from "@/db/schema";
import { deleteImage, ImageValidationError, uploadImage, type ImageKind, type StoredImage } from "@/lib/cloudinary";
import { assertAdmin, ForbiddenError } from "@/lib/session";
import { galleryMetaSchema, uuid } from "@/lib/validations";
import { audit } from "@/services/admin";

// Admin-only image API. The file goes browser -> this handler -> Cloudinary, so the API secret
// never leaves the server and the stored publicId/url always come from Cloudinary, not from the client.
// POST   multipart: target=gallery|menu-item, file, + meta   -> create
// PUT    multipart: target, id, file                          -> replace file (old asset is deleted)
// DELETE ?target=&id=                                         -> remove row + asset
// Every call re-checks the admin role and writes an audit entry.

const target = z.enum(["gallery", "menu-item"]);
const kindFor = (t: "gallery" | "menu-item", group?: string): ImageKind =>
  t === "menu-item" ? "dishes" : group === "team" ? "team" : group === "restaurant" ? "restaurant" : "gallery";

const asset = (s: StoredImage) => ({ url: s.url, publicId: s.publicId, width: s.width, height: s.height, format: s.format, bytes: s.bytes });

function fail(e: unknown) {
  if (e instanceof ForbiddenError) return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  if (e instanceof ImageValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
  if (e instanceof z.ZodError) return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  console.error("[images]", e);
  return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
}

const done = (body: object, status = 200) => {
  revalidatePath("/", "layout");
  return NextResponse.json(body, { status });
};

async function readFile(form: FormData) {
  const file = form.get("file");
  if (!(file instanceof File)) throw new ImageValidationError("Файл не передан");
  return file;
}

export async function POST(req: Request) {
  try {
    const admin = await assertAdmin();
    const form = await req.formData();
    const t = target.parse(form.get("target"));
    const file = await readFile(form);

    if (t === "gallery") {
      const meta = galleryMetaSchema.parse(Object.fromEntries(form));
      const stored = await uploadImage(file, kindFor(t, meta.group));
      const [row] = await db.insert(galleryImages).values({ ...meta, ...asset(stored) }).returning();
      await audit(db, admin, "gallery.upload", "gallery_image", row.id, { group: meta.group, bytes: stored.bytes });
      return done({ image: row }, 201);
    }

    const menuItemId = uuid.parse(form.get("menuItemId"));
    const existing = await db.select({ id: menuItemImages.id }).from(menuItemImages).where(eq(menuItemImages.menuItemId, menuItemId));
    const stored = await uploadImage(file, "dishes");
    const [row] = await db
      .insert(menuItemImages)
      .values({ menuItemId, ...asset(stored), isPrimary: existing.length === 0, sortOrder: existing.length })
      .returning();
    await audit(db, admin, "menu_item.image_add", "menu_item", menuItemId, { imageId: row.id, bytes: stored.bytes });
    return done({ image: row }, 201);
  } catch (e) {
    return fail(e);
  }
}

export async function PUT(req: Request) {
  try {
    const admin = await assertAdmin();
    const form = await req.formData();
    const t = target.parse(form.get("target"));
    const id = uuid.parse(form.get("id"));
    const file = await readFile(form);
    const table = t === "gallery" ? galleryImages : menuItemImages;
    const [old] = await db.select({ publicId: table.publicId }).from(table).where(eq(table.id, id));
    if (!old) return NextResponse.json({ error: "Не найдено" }, { status: 404 });

    const stored = await uploadImage(file, kindFor(t));
    await db.update(table).set(asset(stored)).where(eq(table.id, id));
    await deleteImage(old.publicId).catch((e) => console.error("[images] old asset cleanup failed", e));
    await audit(db, admin, "image.replace", t === "gallery" ? "gallery_image" : "menu_item_image", id, { bytes: stored.bytes });
    return done({ image: { id, ...asset(stored) } });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req: Request) {
  try {
    const admin = await assertAdmin();
    const params = new URL(req.url).searchParams;
    const t = target.parse(params.get("target"));
    const id = uuid.parse(params.get("id"));

    let publicId: string | null;
    if (t === "gallery") {
      const [old] = await db.delete(galleryImages).where(eq(galleryImages.id, id)).returning({ publicId: galleryImages.publicId });
      if (!old) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
      publicId = old.publicId;
    } else {
      // delete + promote the next image in one transaction: the dish never shows without a main photo
      const old = await getTxDb().transaction(async (tx) => {
        const [row] = await tx
          .delete(menuItemImages)
          .where(eq(menuItemImages.id, id))
          .returning({ publicId: menuItemImages.publicId, itemId: menuItemImages.menuItemId, isPrimary: menuItemImages.isPrimary });
        if (row?.isPrimary) {
          const [next] = await tx.select({ id: menuItemImages.id }).from(menuItemImages).where(eq(menuItemImages.menuItemId, row.itemId)).orderBy(asc(menuItemImages.sortOrder), asc(menuItemImages.createdAt)).limit(1);
          if (next) await tx.update(menuItemImages).set({ isPrimary: true }).where(eq(menuItemImages.id, next.id));
        }
        return row;
      });
      if (!old) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
      publicId = old.publicId;
    }
    await deleteImage(publicId).catch((e) => console.error("[images] asset cleanup failed", e));
    await audit(db, admin, "image.delete", t === "gallery" ? "gallery_image" : "menu_item_image", id);
    return done({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
