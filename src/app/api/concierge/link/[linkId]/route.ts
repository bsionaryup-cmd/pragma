import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/concierge/link/[linkId]">,
) {
  await requirePermission("concierge:manage");
  const scope = await requireTenantDataScope();
  if (!scope.organizationId) {
    return NextResponse.json(
      { error: "Organización requerida" },
      { status: 409 },
    );
  }
  const { linkId } = await context.params;
  const result = await db.conciergeExtensionLink.updateMany({
    where: {
      id: linkId,
      organizationId: scope.organizationId,
      status: { not: "REVOKED" },
    },
    data: {
      status: "REVOKED",
      revokedAt: new Date(),
      pairingTokenHash: null,
      pairingExpiresAt: null,
    },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Link no encontrado" }, { status: 404 });
  }
  await db.conciergeAuditEvent.create({
    data: {
      organizationId: scope.organizationId,
      extensionLinkId: linkId,
      eventType: "extension.revoked",
      result: "success",
    },
  });
  return NextResponse.json({ ok: true });
}
