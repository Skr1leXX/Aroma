import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";

/** Salted hash of the caller's IP: enough for rate limiting, useless as personal data. */
export async function clientIpHash() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip");
  if (!ip) return null;
  return createHash("sha256").update(`${ip}|${process.env.BETTER_AUTH_SECRET ?? ""}`).digest("hex");
}
