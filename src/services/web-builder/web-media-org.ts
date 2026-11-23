import "server-only";

import { db } from "@/lib/db";
import { requireTenantContext } from "@/lib/platform/tenant-context";

export async function requireOrgId(): Promise<string> {
  const ctx = await requireTenantContext();
  if (!ctx.organizationId) {
    throw new Error("Se requiere organización para gestionar medios");
  }
  return ctx.organizationId;
}

export async function resolveTenantSiteId(
  organizationId: string,
): Promise<string | null> {
  const site = await db.tenantWebSite.findUnique({
    where: { organizationId },
    select: { id: true },
  });
  return site?.id ?? null;
}