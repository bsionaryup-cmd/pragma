import { NextResponse } from "next/server";
import { requireRetailContext } from "@/domains/retail/auth/require-retail-context";
import { buildIntiendasHelpManualPdf } from "@/domains/retail/help/pdf/manual-pdf";
import { HELP_MANUAL_VERSION } from "@/domains/retail/help/catalog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    await requireRetailContext();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pdf = await buildIntiendasHelpManualPdf();
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="manual-intiendas-${HELP_MANUAL_VERSION}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
