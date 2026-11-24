import { NextResponse } from "next/server";
import {
  requirePlatformOwnerUser,
  platformOwnerErrorResponse,
} from "@/lib/platform/require-platform-owner";
import { voidTenantInvoiceByOwner } from "@/services/platform/owner-invoice-actions.service";

type RouteContext = { params: Promise<{ id: string; invoiceId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const platformUser = await requirePlatformOwnerUser();
    const { id, invoiceId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { reason?: string };

    const invoice = await voidTenantInvoiceByOwner({
      platformUser,
      organizationId: id,
      invoiceId,
      reason: body.reason,
    });

    return NextResponse.json({
      ok: true,
      invoiceId: invoice.id,
      status: invoice.status,
    });
  } catch (error) {
    return platformOwnerErrorResponse(error);
  }
}
