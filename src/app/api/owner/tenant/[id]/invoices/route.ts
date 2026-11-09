import { NextResponse } from "next/server";
import {
  requirePlatformOwnerUser,
  platformOwnerErrorResponse,
} from "@/lib/platform/require-platform-owner";
import { createTenantInvoiceByOwner } from "@/services/platform/owner-invoice-actions.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const platformUser = await requirePlatformOwnerUser();
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      amountCop?: number;
      description?: string;
      dueInDays?: number;
      reason?: string;
    };

    const invoice = await createTenantInvoiceByOwner({
      platformUser,
      organizationId: id,
      amountCop: body.amountCop,
      description: body.description,
      dueInDays: body.dueInDays,
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
