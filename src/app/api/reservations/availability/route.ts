import { NextResponse } from "next/server";
import { availabilityQuerySchema } from "@/lib/validations";
import { getAvailability } from "@/services/reservations";

// Public, read-only. Advisory: the booking action re-validates everything.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const parsed = availabilityQuerySchema.safeParse(params);
  if (!parsed.success) return NextResponse.json({ error: "Некорректные параметры" }, { status: 400 });
  try {
    const result = await getAvailability(parsed.data.date, parsed.data.guests);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[availability]", e);
    return NextResponse.json({ error: "Не удалось загрузить доступное время" }, { status: 503 });
  }
}
