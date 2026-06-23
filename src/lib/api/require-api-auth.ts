import "server-only";

import { currentDbUser } from "@/lib/auth";
import type { Permission } from "@/lib/auth/permissions";
import { hasPermission } from "@/lib/auth/permissions";
import { buildTenantContext } from "@/lib/platform/tenant-context";

export type ApiAuthContext = {
  userId: string;
  organizationId: string;
  email: string;
};

export type ApiAuthFailure = {
  ok: false;
  status: 401 | 403;
  error: string;
};

export type ApiAuthSuccess = {
  ok: true;
  context: ApiAuthContext;
};

export type ApiAuthResult = ApiAuthFailure | ApiAuthSuccess;

export async function resolveApiAuth(
  permission: Permission,
): Promise<ApiAuthResult> {
  const user = await currentDbUser();
  if (!user) {
    return { ok: false, status: 401, error: "No autenticado" };
  }

  const tenant = await buildTenantContext(user);
  if (!hasPermission(tenant.effectiveRole, permission)) {
    return { ok: false, status: 403, error: "No autorizado" };
  }

  if (!tenant.organizationId) {
    return { ok: false, status: 403, error: "Se requiere una organización activa" };
  }

  return {
    ok: true,
    context: {
      userId: user.id,
      organizationId: tenant.organizationId,
      email: user.email,
    },
  };
}
