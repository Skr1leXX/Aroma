import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";

// Liveness/readiness probe for Vercel and uptime monitors. Public on purpose, so it reveals nothing
// beyond "database reachable or not" (no versions, hosts, env names or error text).
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({ status: "ok", database: "up" }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[health] database unreachable", e);
    return NextResponse.json({ status: "degraded", database: "down" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
