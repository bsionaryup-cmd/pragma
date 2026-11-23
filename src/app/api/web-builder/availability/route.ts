import { NextResponse } from "next/server";
import { searchWebAvailabilitySchema } from "@/features/web-builder/schemas/web-builder.schema";
import { checkWebBuilderApiRateLimit } from "@/lib/web-builder/web-api-rate-limit";
import { searchWebAvailability } from "@/services/web-builder/web-booking.service";

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

export async function POST(request: Request) {
  const ip = clientIp(request);
  if (!checkWebBuilderApiRateLimit(ip)) {
    return NextResponse.json(
      { ok: false, error: "Demasiadas solicitudes" },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const parsed = searchWebAvailabilitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 },
    );
  }

  try {
    const result = await searchWebAvailability(parsed.data);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error de disponibilidad",
      },
      { status: 400 },
    );
  }
}