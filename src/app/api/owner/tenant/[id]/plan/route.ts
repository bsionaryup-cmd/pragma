import { NextResponse } from "next/server";
import { BillingPlanCode } from "@prisma/client";
import {
  requirePlatformOwnerUser,
  platformOwnerErrorResponse,
} from "@/lib/platform/require-platform-owner";
import { updateTenantPlan } from "@/services/platform/owner-tenant-admin.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requirePlatformOwnerUser();
    const { id } = await context.params;
    const body = (await request.json()) as { plan?: string };

    if (!body.plan || !(body.plan in BillingPlanCode)) {
      return NextResponse.json({ error: "Plan inválido" }, { status: 400 });
    }

    await updateTenantPlan(user, id, body.plan as BillingPlanCode);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return platformOwnerErrorResponse(error);
  }
}
