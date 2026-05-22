import { NextResponse } from "next/server";
import { getAuthContext, hasPermission } from "@/lib/auth";
import type { AppUserRole } from "@/types/auth";
import { getBillingInvoiceDocument } from "@/modules/billing/services/billing-invoice-document.service";
import {
  billingInvoicePdfFilename,
  generateBillingInvoicePdf,
} from "@/modules/billing/services/billing-invoice-pdf.service";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ invoiceId: string }>;
};

async function requireBillingManager() {
  const auth = await getAuthContext();
  if (!auth || !hasPermission(auth.role as AppUserRole, "billing:manage")) {
    return null;
  }
  return auth;
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireBillingManager();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { invoiceId } = await context.params;
  const document = await getBillingInvoiceDocument(invoiceId);

  if (!document) {
    return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
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
