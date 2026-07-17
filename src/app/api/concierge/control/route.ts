import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";
import {
  getConciergeDashboard,
  getOrCreateConciergeConfiguration,
  updateConciergeConfiguration,
} from "@/modules/ai-concierge/channel/operational-state";

export const runtime = "nodejs";

const PatchSchema = z
  .object({
    enabled: z.boolean().optional(),
    paused: z.boolean().optional(),
    mode: z
      .enum(["observe", "manual", "assisted", "autonomous"])
      .optional(),
    whatsappEnabled: z.boolean().optional(),
    airbnbEnabled: z.boolean().optional(),
    allowedPropertyIds: z.array(z.string().trim().min(1)).max(200).optional(),
    allowedTools: z.array(z.string().trim().min(1)).max(100).optional(),
    aiEnabled: z.boolean().optional(),
    auditorEnabled: z.boolean().optional(),
  })
  .strict();

async function requireConciergeAdmin() {
  const [auth, scope] = await Promise.all([
    requirePermission("concierge:manage"),
    requireTenantDataScope(),
  ]);
  if (!scope.organizationId) {
    throw new Error("AI Concierge requiere una organización activa");
  }
  return {
    organizationId: scope.organizationId,
    userId: auth.dbUserId,
  };
}

export async function GET() {
  const ctx = await requireConciergeAdmin();
  await getOrCreateConciergeConfiguration(ctx);
  return NextResponse.json({
    ok: true,
    dashboard: await getConciergeDashboard(ctx.organizationId),
  });
}

export async function PATCH(request: Request) {
  const ctx = await requireConciergeAdmin();
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
  await updateConciergeConfiguration({
    ...ctx,
    patch: parsed.data,
  });
  return NextResponse.json({
    ok: true,
    dashboard: await getConciergeDashboard(ctx.organizationId),
  });
}
