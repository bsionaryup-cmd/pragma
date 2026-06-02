import "server-only";

import { requireTenantContext } from "@/lib/platform/tenant-context";

export async function assertTenantEpaycoScope(organizationId: string): Promise<void> {
  const ctx = await requireTenantContext();
  if (!ctx.organizationId) {
    throw new Error("Organización requerida");
  }
  if (ctx.organizationId !== organizationId) {
    throw new Error("Acceso denegado a integración ePayco");
  }
}
