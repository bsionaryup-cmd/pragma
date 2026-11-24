import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requirePlatformOwnerUser, platformOwnerErrorResponse } from "@/lib/platform/require-platform-owner";
import { parseValidUntilDateInput } from "@/lib/billing/tenant-account-state";
import { setTenantValidUntilByOwner } from "@/services/platform/owner-billing-actions.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const platformUser = await requirePlatformOwnerUser();
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      validUntil?: string;
      kind?: string;
      reason?: string;
    };
    const validUntil = parseValidUntilDateInput(body.validUntil);
    if (!validUntil) {
      return NextResponse.json({ error: "Fecha 'Vigente hasta' inválida" }, { status: 400 });
    }
    if (body.kind !== "trial" && body.kind !== "subscription") {
      return NextResponse.json({ error: "Tipo de vigencia inválido" }, { status: 400 });
    }
    await setTenantValidUntilByOwner({
      platformUser,
      organizationId: id,
      validUntil,
      kind: body.kind,
      reason: body.reason,
    });
    revalidatePath("/", "layout");
    revalidatePath("/owner-dashboard", "layout");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return platformOwnerErrorResponse(error);
  }
}
