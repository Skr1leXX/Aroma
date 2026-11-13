// Minimal stand-in for the Cloudinary upload API so image flows can be exercised offline.
// The real SDK talks to it through CLOUDINARY_URL=cloudinary://key:secret@cloud?upload_prefix=http://127.0.0.1:PORT
import { createServer } from "node:http";

export const CLOUDINARY_PORT = Number(process.env.E2E_CLOUDINARY_PORT ?? 54330);
export const calls: { op: string; publicId?: string; folder?: string }[] = [];

export function startFakeCloudinary() {
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString("latin1");
      const field = (n: string) => body.match(new RegExp(`name="${n}"\\r\\n\\r\\n([^\\r]*)`))?.[1];
      res.setHeader("Content-Type", "application/json");
      if (req.url?.includes("/image/upload")) {
        const folder = field("folder") ?? "";
        const id = `${folder}/fake_${Math.random().toString(36).slice(2, 10)}`;
        calls.push({ op: "upload", publicId: id, folder });
        res.end(JSON.stringify({
          public_id: id, secure_url: `http://127.0.0.1:${CLOUDINARY_PORT}/img/${id}.jpg`, width: 800, height: 600, format: "jpg", bytes: body.length,
        }));
      } else if (req.url?.includes("/image/destroy")) {
        const id = field("public_id");
        calls.push({ op: "destroy", publicId: id });
        res.end(JSON.stringify({ result: "ok" }));
      } else if (req.url?.startsWith("/img/")) {
        // a 1x1 gif so <img> requests succeed
        res.setHeader("Content-Type", "image/gif");
        res.end(Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"));
      } else {
        res.statusCode = 404;
        res.end("{}");
      }
    });
  });
  return new Promise<typeof server>((resolve) => server.listen(CLOUDINARY_PORT, "127.0.0.1", () => resolve(server)));
}
