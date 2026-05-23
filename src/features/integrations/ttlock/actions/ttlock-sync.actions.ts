"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { syncSmartLocksForOrganization } from "@/modules/integrations/ttlock/ttlock.scheduler";
import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";

export async function syncPropertySmartLockAction(propertyId: string) {
  await requirePermission("integrations:manage");
  const scope = await requireTenantDataScope();
  if (!scope.organizationId) {
    return { ok: false, message: "Organización no encontrada" };
  }

  const summary = await syncSmartLocksForOrganization(scope.organizationId);
  revalidatePath(`/properties`);
  revalidatePath(`/smart-access`);
  revalidatePath(`/integrations/ttlock`);

  return {
    ok: summary.errors.length === 0,
    message:
      summary.errors[0] ??
      `Sincronizadas ${summary.locksUpdated} cerradura(s)`,
  };
}
