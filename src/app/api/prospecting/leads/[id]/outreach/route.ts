import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/api/require-api-auth";
import { OpenAiEnrichmentError } from "@/modules/sales-console/enrichment/enrichment.errors";
import { isOpenAiEnrichmentConfigured } from "@/modules/sales-console/enrichment/openai-sales.client";
import { generateProspectingOutreach } from "@/services/prospecting/prospecting-outreach.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const auth = await resolveApiAuth("integrations:read");
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  if (!isOpenAiEnrichmentConfigured()) {
    return NextResponse.json(
      { success: false, error: "Configura OPENAI_API_KEY para generar mensajes" },
      { status: 503 },
    );
  }

  try {
    const { id } = await context.params;
    const result = await generateProspectingOutreach(auth.context.organizationId, id);
    return NextResponse.json({
      success: true,
      message: result.message,
      lead: result.lead,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Prospecto no encontrado") {
      return NextResponse.json({ success: false, error: error.message }, { status: 404 });
    }
    if (error instanceof OpenAiEnrichmentError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 502 });
    }
    console.error("[prospecting/outreach]", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { success: false, error: "No se pudo generar el mensaje" },
      { status: 500 },
    );
  }
}
