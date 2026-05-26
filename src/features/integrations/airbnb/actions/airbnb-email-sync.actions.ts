"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";
import {
  ensureTenantAirbnbEmailIntegration,
  getTenantAirbnbEmailIntegration,
  setTenantAirbnbEmailIntegrationEnabled,
  type TenantAirbnbEmailIntegrationView,
} from "@/services/integrations/tenant-airbnb-email-integration.service";
import { syncListingEmailMapsForOrganization } from "@/services/integrations/airbnb-listing-email-map.service";

export async function getAirbnbEmailSyncIntegrationAction(): Promise<TenantAirbnbEmailIntegrationView | null> {
  await requirePermission("integrations:read");
  const scope = await requireTenantDataScope();
  if (!scope.organizationId) return null;
  return getTenantAirbnbEmailIntegration(scope.organizationId);
}

export async function enableAirbnbEmailSyncAction(): Promise<{
  success: boolean;
  integration?: TenantAirbnbEmailIntegrationView;
  error?: string;
}> {
  const auth = await requirePermission("integrations:manage");
  const scope = await requireTenantDataScope();
  if (!scope.organizationId) {
    return { success: false, error: "Organización requerida" };
  }

  try {
    await ensureTenantAirbnbEmailIntegration(scope, auth.dbUserId);
    const integration = await setTenantAirbnbEmailIntegrationEnabled(
      scope,
      true,
      auth.dbUserId,
    );
    revalidatePath("/integrations/airbnb");
    return { success: true, integration };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "No se pudo activar",
    };
  }
}

export async function disableAirbnbEmailSyncAction(): Promise<{
  success: boolean;
  error?: string;
}> {
  const auth = await requirePermission("integrations:manage");
  const scope = await requireTenantDataScope();
  if (!scope.organizationId) {
    return { success: false, error: "Organización requerida" };
  }

  try {
    await setTenantAirbnbEmailIntegrationEnabled(scope, false, auth.dbUserId);
    revalidatePath("/integrations/airbnb");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "No se pudo desactivar",
    };
  }
}

export async function refreshAirbnbListingEmailMapsAction(): Promise<{
  success: boolean;
  count?: number;
  error?: string;
}> {
  await requirePermission("integrations:manage");
  const scope = await requireTenantDataScope();
  if (!scope.organizationId) {
    return { success: false, error: "Organización requerida" };
  }

  try {
    const count = await syncListingEmailMapsForOrganization(
      scope.organizationId,
    );
    revalidatePath("/integrations/airbnb");
    return { success: true, count };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al sincronizar",
    };
  }
}
