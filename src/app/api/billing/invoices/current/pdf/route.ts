import { NextResponse } from "next/server";
import { getAuthContext, hasPermission } from "@/lib/auth";
import type { AppUserRole } from "@/types/auth";
import { getCurrentPlanInvoiceDocument } from "@/modules/billing/services/billing-invoice-document.service";
import {
  billingInvoicePdfFilename,
  generateBillingInvoicePdf,
} from "@/modules/billing/services/billing-invoice-pdf.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await getAuthContext();
  if (!auth || !hasPermission(auth.role as AppUserRole, "billing:manage")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const document = await getCurrentPlanInvoiceDocument();
  if (!document) {
    return NextResponse.json(
      { error: "No hay datos de facturación disponibles" },
      { status: 404 },
    );
  }

  const pdf = await generateBillingInvoicePdf(document);
  const filename = billingInvoicePdfFilename(document);

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
