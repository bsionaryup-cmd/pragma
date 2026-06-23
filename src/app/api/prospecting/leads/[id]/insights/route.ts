import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/api/require-api-auth";
import { OpenAiEnrichmentError } from "@/modules/sales-console/enrichment/enrichment.errors";
import { isOpenAiEnrichmentConfigured } from "@/modules/sales-console/enrichment/openai-sales.client";
import { generateProspectingInsights } from "@/services/prospecting/prospecting-insights.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const auth = await resolveApiAuth("integrations:read");
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  if (!isOpenAiEnrichmentConfigured()) {
    return NextResponse.json(
      { success: false, error: "Configura OPENAI_API_KEY para clasificar prospectos" },
      { status: 503 },
    );
  }

  try {
    const { id } = await context.params;
    const result = await generateProspectingInsights(auth.context.organizationId, id);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof Error && error.message === "Prospecto no encontrado") {
      return NextResponse.json({ success: false, error: error.message }, { status: 404 });
    }
    if (error instanceof OpenAiEnrichmentError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 502 });
    }
    console.error("[prospecting/insights]", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { success: false, error: "No se pudo clasificar el prospecto" },
      { status: 500 },
    );
  }
}
