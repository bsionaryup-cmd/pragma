import { NextResponse } from "next/server";
import { z } from "zod";
import { getConciergeDashboard } from "@/modules/ai-concierge/channel/operational-state";
import {
  getConciergeRuntimeSnapshot,
  setConciergeRuntimeDesired,
  tickConciergeRuntime,
} from "@/modules/ai-concierge/runtime/service";
import {
  ownerConciergeErrorResponse,
  requireOwnerConciergeOrg,
} from "@/modules/assistant-platform/owner-concierge-auth";

export const runtime = "nodejs";

const PatchSchema = z
  .object({
    organizationId: z.string().trim().min(1),
    desiredOn: z.boolean(),
  })
  .strict();

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const ctx = await requireOwnerConciergeOrg({
      organizationId: url.searchParams.get("organizationId"),
    });
    const tick = await tickConciergeRuntime({
      organizationId: ctx.organizationId,
    });
    const snapshot = await getConciergeRuntimeSnapshot(ctx.organizationId);
    return NextResponse.json({
      ok: true,
      runtime: { ...snapshot, ...tick },
      dashboard: await getConciergeDashboard(ctx.organizationId),
    });
  } catch (error) {
    const mapped = ownerConciergeErrorResponse(error);
    console.error("[concierge/runtime GET]", mapped.error);
    return NextResponse.json(
      { ok: false, error: mapped.error },
      { status: mapped.status },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    let json: unknown;
    try {
      json = await request.json();
    } catch {
      return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
    }
    const parsed = PatchSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Payload inválido", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const ctx = await requireOwnerConciergeOrg({
      organizationId: parsed.data.organizationId,
    });
    await setConciergeRuntimeDesired({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      desiredOn: parsed.data.desiredOn,
    });
    const snapshot = await getConciergeRuntimeSnapshot(ctx.organizationId);
    return NextResponse.json({
      ok: true,
      runtime: snapshot,
      dashboard: await getConciergeDashboard(ctx.organizationId),
    });
  } catch (error) {
    const mapped = ownerConciergeErrorResponse(error);
    console.error("[concierge/runtime PATCH]", mapped.error);
    return NextResponse.json(
      { ok: false, error: mapped.error },
      { status: mapped.status },
    );
  }
}
