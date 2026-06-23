import { NextResponse } from "next/server";
import { z } from "zod";
import { isApifyConfigured } from "@/lib/apify/apify-client";
import { resolveApiAuth } from "@/lib/api/require-api-auth";
import { importTenantProspectingRun } from "@/services/prospecting/prospecting-apify.service";

export const maxDuration = 30;

const importBodySchema = z.object({
  runId: z.string().trim().min(1).max(128),
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

  try {
    const json: unknown = await request.json();
    const parsed = importBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Solicitud inválida" },
        { status: 400 },
      );
    }

    const result = await importTenantProspectingRun(
      auth.context.organizationId,
      parsed.data.runId,
    );

    if (result.phase === "RUNNING") {
      return NextResponse.json({
        success: true,
        status: "RUNNING",
      });
    }

    if (result.phase === "FAILED") {
      return NextResponse.json(
        { success: false, status: "FAILED", error: result.error },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      status: "SUCCEEDED",
      total: result.inserted,
      skipped: result.skipped,
      skippedInvalid: result.skippedInvalid,
    });
  } catch (error) {
    console.error("[prospecting/import]", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { success: false, error: "No se pudo importar la búsqueda de prospectos" },
      { status: 500 },
    );
  }
}
