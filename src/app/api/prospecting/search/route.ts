import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { isApifyConfigured } from "@/lib/apify/apify-client";
import { scrapeGoogleMaps } from "@/lib/apify/googleMaps";
import { saveLeads } from "@/lib/apify/saveLead";
import { requireTenantContext } from "@/lib/platform/tenant-context";

const searchBodySchema = z.object({
  query: z.string().trim().min(2).max(200),
});

export async function POST(request: Request) {
  try {
    await requirePermission("integrations:read");
    const tenant = await requireTenantContext();

    if (!tenant.organizationId) {
      return NextResponse.json(
        { success: false, error: "Se requiere una organización activa" },
        { status: 403 },
      );
    }

    if (!isApifyConfigured()) {
      return NextResponse.json(
        { success: false, error: "Configura APIFY_TOKEN para habilitar la búsqueda" },
        { status: 503 },
      );
    }

    const json: unknown = await request.json();
    const parsed = searchBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Consulta inválida" },
        { status: 400 },
      );
    }

    const leads = await scrapeGoogleMaps(parsed.data.query);
    const { inserted } = await saveLeads(tenant.organizationId, leads);

    return NextResponse.json({
      success: true,
      total: inserted,
    });
  } catch (error) {
    console.error("[prospecting/search]", error);
    return NextResponse.json(
      { success: false, error: "No se pudo completar la búsqueda de prospectos" },
      { status: 500 },
    );
  }
}
