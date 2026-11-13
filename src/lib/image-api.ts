// Browser-side helper for /api/admin/images. Validates size before uploading; the server validates again.
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const ACCEPT = "image/jpeg,image/png,image/webp,image/avif";

export function checkFile(file: File | null | undefined) {
  if (!file || file.size === 0) return "Выберите файл";
  if (file.size > MAX_UPLOAD_BYTES) return "Файл больше 8 МБ";
  return null;
}

export async function imageApi(method: "POST" | "PUT" | "DELETE", body?: FormData, query = "") {
  const res = await fetch(`/api/admin/images${query}`, { method, body });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Ошибка загрузки");
  return json;
}
