import {
  AirbnbEmailIntegrationStatus,
  AirbnbEmailInboundProvider,
} from "@prisma/client";
import { db } from "@/lib/db";
import { syncListingEmailMapsForOrganization } from "@/services/integrations/airbnb-listing-email-map.service";
import type { TenantDataScope } from "@/lib/platform/tenant-data-scope";

export type TenantAirbnbEmailIntegrationView = {
  id: string;
  organizationId: string;
  enabled: boolean;
  provider: AirbnbEmailInboundProvider;
  inboundEmailAddress: string;
  syncStatus: AirbnbEmailIntegrationStatus;
  lastEmailReceivedAt: string | null;
  lastProcessedAt: string | null;
  lastError: string | null;
  listingMapCount: number;
};

function normalizeInboundLocalPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function getConfiguredInboundEmailDomain(): string {
  return (
    process.env.AIRBNB_INBOUND_EMAIL_DOMAIN?.trim() || "inbound.pragmapms.com"
  );
}

function inboundEmailUsesConfiguredDomain(address: string): boolean {
  const at = address.lastIndexOf("@");
  if (at < 0) return false;
  return (
    address.slice(at + 1).toLowerCase() ===
    getConfiguredInboundEmailDomain().toLowerCase()
  );
}

export function buildDefaultInboundEmailAddress(organization: {
  id: string;
  name: string;
}): string {
  const domain = getConfiguredInboundEmailDomain();
  const slug = normalizeInboundLocalPart(organization.name) || "tenant";
  const suffix = organization.id.slice(-6).toLowerCase();
  return `${slug}-${suffix}@${domain}`;
}

/** Re-alinea inbound persistido si cambió AIRBNB_INBOUND_EMAIL_DOMAIN (sin tocar local-part salvo rebuild estándar). */
async function alignInboundEmailAddressWithEnv(
  organization: { id: string; name: string },
  persistedAddress: string,
): Promise<string> {
  if (inboundEmailUsesConfiguredDomain(persistedAddress)) {
    return persistedAddress;
  }

  const nextAddress = buildDefaultInboundEmailAddress(organization);
  await db.tenantAirbnbEmailIntegration.update({
    where: { organizationId: organization.id },
    data: { inboundEmailAddress: nextAddress },
  });
  return nextAddress;
}

export async function getTenantAirbnbEmailIntegration(
  organizationId: string,
): Promise<TenantAirbnbEmailIntegrationView | null> {
  const row = await db.tenantAirbnbEmailIntegration.findUnique({
    where: { organizationId },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          _count: { select: { airbnbListingEmailMaps: true } },
        },
      },
    },
  });

  if (!row) return null;

  const inboundEmailAddress = await alignInboundEmailAddressWithEnv(
    row.organization,
    row.inboundEmailAddress,
  );

  return {
    id: row.id,
    organizationId: row.organizationId,
    enabled: row.enabled,
    provider: row.provider,
    inboundEmailAddress,
    syncStatus: row.syncStatus,
    lastEmailReceivedAt: row.lastEmailReceivedAt?.toISOString() ?? null,
    lastProcessedAt: row.lastProcessedAt?.toISOString() ?? null,
    lastError: row.lastError,
    listingMapCount: row.organization._count.airbnbListingEmailMaps,
  };
}

export async function ensureTenantAirbnbEmailIntegration(
  scope: TenantDataScope,
  configuredById: string,
): Promise<TenantAirbnbEmailIntegrationView> {
  if (!scope.organizationId) {
    throw new Error("Se requiere organización para Airbnb Email Sync");
  }

  const organization = await db.organization.findUniqueOrThrow({
    where: { id: scope.organizationId },
    select: { id: true, name: true },
  });

  const existing = await db.tenantAirbnbEmailIntegration.findUnique({
    where: { organizationId: organization.id },
  });

  if (existing) {
    const view = await getTenantAirbnbEmailIntegration(organization.id);
    return view!;
  }

  const created = await db.tenantAirbnbEmailIntegration.create({
    data: {
      organizationId: organization.id,
      inboundEmailAddress: buildDefaultInboundEmailAddress(organization),
      configuredById,
      enabled: false,
      syncStatus: AirbnbEmailIntegrationStatus.DISABLED,
      provider: AirbnbEmailInboundProvider.RESEND,
    },
  });

  await syncListingEmailMapsForOrganization(organization.id);

  return {
    id: created.id,
    organizationId: created.organizationId,
    enabled: created.enabled,
    provider: created.provider,
    inboundEmailAddress: created.inboundEmailAddress,
    syncStatus: created.syncStatus,
    lastEmailReceivedAt: null,
    lastProcessedAt: null,
    lastError: null,
    listingMapCount: await db.airbnbListingEmailMap.count({
      where: { organizationId: organization.id },
    }),
  };
}

export async function setTenantAirbnbEmailIntegrationEnabled(
  scope: TenantDataScope,
  enabled: boolean,
  configuredById: string,
): Promise<TenantAirbnbEmailIntegrationView> {
  const base = await ensureTenantAirbnbEmailIntegration(scope, configuredById);
  if (!scope.organizationId) throw new Error("Organización requerida");

  await syncListingEmailMapsForOrganization(scope.organizationId);

  await db.tenantAirbnbEmailIntegration.update({
    where: { organizationId: scope.organizationId },
    data: {
      enabled,
      syncStatus: enabled
        ? AirbnbEmailIntegrationStatus.ACTIVE
        : AirbnbEmailIntegrationStatus.DISABLED,
      lastError: null,
      configuredById,
    },
  });

  const view = await getTenantAirbnbEmailIntegration(scope.organizationId);
  return view!;
}

export async function resolveOrganizationByInboundEmail(
  toAddresses: string[],
): Promise<{
  organizationId: string;
  integrationId: string;
  enabled: boolean;
} | null> {
  const normalized = toAddresses.map((a) => a.trim().toLowerCase()).filter(Boolean);
  if (!normalized.length) return null;

  const integration = await db.tenantAirbnbEmailIntegration.findFirst({
    where: {
      inboundEmailAddress: { in: normalized },
    },
    select: {
      id: true,
      organizationId: true,
      enabled: true,
    },
  });

  if (!integration) return null;

  return {
    organizationId: integration.organizationId,
    integrationId: integration.id,
    enabled: integration.enabled,
  };
}

export async function touchIntegrationEmailReceived(
  integrationId: string,
  processed: boolean,
  error?: string | null,
) {
  await db.tenantAirbnbEmailIntegration.update({
    where: { id: integrationId },
    data: {
      lastEmailReceivedAt: new Date(),
      ...(processed
        ? {
            lastProcessedAt: new Date(),
            lastError: null,
            syncStatus: AirbnbEmailIntegrationStatus.ACTIVE,
          }
        : {
            lastError: error ?? "Error de procesamiento",
            syncStatus: AirbnbEmailIntegrationStatus.ERROR,
          }),
    },
  });
}
