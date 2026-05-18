import { buildPropertyExportIcal } from "@/services/airbnb/ical-export.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return new Response("Token requerido", { status: 400 });
  }

  const ical = await buildPropertyExportIcal(token);
  if (!ical) {
    return new Response("Calendario no encontrado", { status: 404 });
  }

  return new Response(ical, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="pragma-export.ics"',
      "Cache-Control": "private, max-age=60, must-revalidate",
    },
  });
}
