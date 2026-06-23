import { NextResponse } from "next/server";
import { z } from "zod";
import {
  checkProspectingSearchRateLimit,
  PROSPECTING_SEARCH_RATE_LIMIT_MS,
} from "@/lib/apify/prospecting-rate-limit";
import { isApifyConfigured } from "@/lib/apify/apify-client";
import { resolveApiAuth } from "@/lib/api/require-api-auth";
import { startTenantProspectingSearch } from "@/services/prospecting/prospecting-apify.service";

export const maxDuration = 30;

const searchBodySchema = z.object({
  query: z.string().trim().min(2).max(200),
});

export async function POST(request: Request) {
  const auth = await resolveApiAuth("integrations:read");
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status },
    );
  }

  if (!isApifyConfigured()) {
    return NextResponse.json(
      { success: false, error: "Configura APIFY_TOKEN para habilitar la búsqueda" },
      { status: 503 },
    );
  }

  if (
    !checkProspectingSearchRateLimit(
      auth.context.organizationId,
      auth.context.userId,
    )
  ) {
    return NextResponse.json(
      {
        success: false,
        error: `Espera ${Math.ceil(PROSPECTING_SEARCH_RATE_LIMIT_MS / 1000)} segundos antes de iniciar otra búsqueda`,
      },
      { status: 429 },
    );
  }

  try {
    const json: unknown = await request.json();
    const parsed = searchBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Consulta inválida" },
        { status: 400 },
      );
    }

    const { runId } = await startTenantProspectingSearch(parsed.data.query);

    return NextResponse.json({
      success: true,
      status: "RUNNING",
      runId,
    });
  } catch (error) {
    console.error("[prospecting/search]", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { success: false, error: "No se pudo iniciar la búsqueda de prospectos" },
      { status: 500 },
    );
  }
}
