import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import "server-only";

/** Where an image is used. Maps to a Cloudinary folder. */
export const imageKinds = ["dishes", "gallery", "restaurant", "team"] as const;
export type ImageKind = (typeof imageKinds)[number];

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export type StoredImage = {
  url: string;
  publicId: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
};

export class ImageValidationError extends Error {}

let configured = false;
function client() {
  if (!configured) {
    const { CLOUDINARY_CLOUD_NAME: cloud, CLOUDINARY_API_KEY: key, CLOUDINARY_API_SECRET: secret } = process.env;
    if (!cloud || !key || !secret) throw new Error("Cloudinary is not configured (see .env.example)");
    // Tests point the SDK at a local stand-in via CLOUDINARY_URL=...?upload_prefix=http://127.0.0.1:PORT (read by the SDK at load).
    cloudinary.config({ cloud_name: cloud, api_key: key, api_secret: secret, secure: true });
    configured = true;
  }
  return cloudinary;
}

// Magic bytes: do not trust the client-declared MIME type.
const signatures: { mime: string; test: (b: Uint8Array) => boolean }[] = [
  { mime: "image/jpeg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/png", test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { mime: "image/webp", test: (b) => String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP" },
  { mime: "image/avif", test: (b) => String.fromCharCode(...b.slice(4, 12)) === "ftypavif" },
];

export async function validateImage(file: File): Promise<Buffer> {
  if (file.size === 0) throw new ImageValidationError("Файл пустой");
  if (file.size > MAX_IMAGE_BYTES) throw new ImageValidationError("Файл больше 8 МБ");
  const buffer = Buffer.from(await file.arrayBuffer());
  if (!signatures.some((s) => s.test(buffer))) {
    throw new ImageValidationError("Допустимы только JPEG, PNG, WebP и AVIF");
  }
  return buffer;
}

export async function uploadImage(file: File, kind: ImageKind): Promise<StoredImage> {
  const buffer = await validateImage(file);
  const res = await new Promise<UploadApiResponse>((resolve, reject) => {
    client()
      .uploader.upload_stream({ folder: `aroma/${kind}`, resource_type: "image", overwrite: false }, (err, r) =>
        err || !r ? reject(err ?? new Error("Upload failed")) : resolve(r),
      )
      .end(buffer);
  });
  return {
    url: res.secure_url,
    publicId: res.public_id,
    width: res.width,
    height: res.height,
    format: res.format,
    bytes: res.bytes,
  };
}

export async function deleteImage(publicId: string | null) {
  if (!publicId) return; // seed/external image: nothing stored in Cloudinary
  await client().uploader.destroy(publicId, { resource_type: "image", invalidate: true });
}

/** Delivery URL with on-the-fly resize/format. Safe to call on the client-visible side: no secret used. */
export function imageUrl(publicId: string, opts: { width?: number; height?: number } = {}) {
  return client().url(publicId, {
    secure: true,
    transformation: [{ width: opts.width, height: opts.height, crop: "fill", quality: "auto", fetch_format: "auto" }],
  });
}
