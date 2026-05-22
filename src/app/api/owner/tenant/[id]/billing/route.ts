import { NextResponse } from "next/server";
import { BillingSubscriptionStatus } from "@prisma/client";
import {
  requirePlatformOwnerUser,
  platformOwnerErrorResponse,
} from "@/lib/platform/require-platform-owner";
import { updateTenantBillingStatus } from "@/services/platform/owner-tenant-admin.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requirePlatformOwnerUser();
    const { id } = await context.params;
    const body = (await request.json()) as { status?: string };

    if (!body.status || !(body.status in BillingSubscriptionStatus)) {
      return NextResponse.json({ error: "Estado de facturación inválido" }, { status: 400 });
    }

    await updateTenantBillingStatus(
      user,
      id,
      body.status as BillingSubscriptionStatus,
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return platformOwnerErrorResponse(error);
  }
}
