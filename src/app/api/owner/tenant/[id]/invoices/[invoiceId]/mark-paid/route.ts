import { NextResponse } from "next/server";
import {
  requirePlatformOwnerUser,
  platformOwnerErrorResponse,
} from "@/lib/platform/require-platform-owner";
import { markTenantInvoicePaidByOwner } from "@/services/platform/owner-invoice-actions.service";

type RouteContext = { params: Promise<{ id: string; invoiceId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const platformUser = await requirePlatformOwnerUser();
    const { id, invoiceId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      paymentReference?: string;
      note?: string;
      activateSubscription?: boolean;
      reason?: string;
    };

    const result = await markTenantInvoicePaidByOwner({
      platformUser,
      organizationId: id,
      invoiceId,
      paymentReference: body.paymentReference,
      note: body.note,
      activateSubscription: body.activateSubscription,
      reason: body.reason,
    });

    return NextResponse.json({
      ok: true,
      alreadyPaid: result.alreadyPaid,
      invoiceId: result.invoice.id,
      status: result.invoice.status,
    });
  } catch (error) {
    return platformOwnerErrorResponse(error);
  }
}
