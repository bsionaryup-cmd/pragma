import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requirePlatformOwnerUser, platformOwnerErrorResponse } from "@/lib/platform/require-platform-owner";
import { parseValidUntilDateInput } from "@/lib/billing/tenant-account-state";
import { setTenantAccessByOwner } from "@/services/platform/owner-billing-actions.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const platformUser = await requirePlatformOwnerUser();
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      active?: boolean;
      validUntil?: string;
      kind?: string;
      reason?: string;
    };
    if (typeof body.active !== "boolean") {
      return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
    }

    let validUntil: Date | null = null;
    if (body.validUntil) {
      validUntil = parseValidUntilDateInput(body.validUntil);
      if (!validUntil) {
        return NextResponse.json({ error: "Fecha 'Vigente hasta' inválida" }, { status: 400 });
      }
    }
    const kind =
      body.kind === "trial" || body.kind === "subscription" ? body.kind : undefined;

    await setTenantAccessByOwner({
      platformUser,
      organizationId: id,
      active: body.active,
      validUntil,
      kind,
      reason: body.reason,
    });
    revalidatePath("/", "layout");
    revalidatePath("/owner-dashboard", "layout");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return platformOwnerErrorResponse(error);
  }
}
