import {
  buildPropertyExportIcalByPropertyId,
  stripIcsExtension,
} from "@/services/airbnb/ical-export.service";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ propertyId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { propertyId: rawId } = await context.params;
  const propertyId = stripIcsExtension(rawId);
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return new Response("Token de exportación requerido", { status: 400 });
  }

  const ical = await buildPropertyExportIcalByPropertyId(propertyId, token);
  if (!ical) {
    return new Response("Calendario no encontrado", { status: 404 });
  }

  return new Response(ical, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="pragma-${propertyId}.ics"`,
      "Cache-Control": "private, max-age=60, must-revalidate",
    },
  });
}
