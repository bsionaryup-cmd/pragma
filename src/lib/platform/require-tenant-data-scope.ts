import "server-only";

import {
  getEffectiveOrganizationIdForUser,
  requireTenantContext,
} from "@/lib/platform/tenant-context";
import type { TenantDataScope } from "@/lib/platform/tenant-data-scope";

export async function requireTenantDataScope(): Promise<TenantDataScope> {
  const tenant = await requireTenantContext();

  return {
    organizationId: tenant.organizationId,
    userId: tenant.userId,
  };
}

export async function resolveTenantDataScopeForUserId(
  userId: string,
): Promise<TenantDataScope> {
  const organizationId = await getEffectiveOrganizationIdForUser(userId);
  return { organizationId, userId };
}
