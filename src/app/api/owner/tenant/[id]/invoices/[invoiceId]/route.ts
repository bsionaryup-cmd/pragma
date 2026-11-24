import { NextResponse } from "next/server";
import {
  requirePlatformOwnerUser,
  platformOwnerErrorResponse,
} from "@/lib/platform/require-platform-owner";
import { updateTenantInvoiceByOwner } from "@/services/platform/owner-invoice-actions.service";

type RouteContext = { params: Promise<{ id: string; invoiceId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const platformUser = await requirePlatformOwnerUser();
    const { id, invoiceId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      amountCop?: number;
      description?: string;
      reason?: string;
    };

    const invoice = await updateTenantInvoiceByOwner({
      platformUser,
      organizationId: id,
      invoiceId,
      amountCop: body.amountCop,
      description: body.description,
      reason: body.reason,
    });

    return NextResponse.json({
      ok: true,
      invoice: {
        id: invoice.id,
        amount: Number(invoice.amount),
        currency: invoice.currency,
        status: invoice.status,
        dueAt: invoice.dueAt.toISOString(),
        description: invoice.description,
      },
    });
  } catch (error) {
    return platformOwnerErrorResponse(error);
  }
}
