import "server-only";

import { resolveWompiConfig } from "@/modules/billing/services/wompi-credentials";
import { resolvePlatformWompiOrganizationId } from "@/modules/billing/services/wompi-platform.service";

/** Evita mezclar credenciales SaaS (platform org) con cobros de huéspedes del tenant. */
export async function assertTenantGuestWompiScope(organizationId: string): Promise<void> {
  const platformOrgId = await resolvePlatformWompiOrganizationId();
  if (platformOrgId && organizationId === platformOrgId) {
    throw new Error(
      "La organización de facturación SaaS no puede usarse para Payment Links de huéspedes.",
    );
  }

  const config = await resolveWompiConfig(organizationId);
  if (!config.configured) {
    throw new Error("Wompi del tenant no está configurado");
  }
}
