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

/** Extrae email bare de headers tipo `Nombre <addr@dominio>` o lista CSV. */
export function parseInboundEmailAddress(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;

  const angle = trimmed.match(/<([^>]+@[^>]+)>/);
  if (angle?.[1]) return angle[1].trim();

  const emailMatch = trimmed.match(
    /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i,
  );
  if (emailMatch?.[0]) return emailMatch[0].toLowerCase();

  return trimmed.includes("@") ? trimmed : null;
}

export function normalizeInboundRecipientList(
  toAddresses: string[],
): string[] {
  const unique = new Set<string>();
  for (const raw of toAddresses) {
    const parts = raw.split(",");
    for (const part of parts) {
      const parsed = parseInboundEmailAddress(part);
      if (parsed) unique.add(parsed);
    }
  }
  return [...unique];
}

function getInboundLocalPart(address: string): string | null {
  const at = address.lastIndexOf("@");
  if (at < 1) return null;
  return address.slice(0, at).toLowerCase();
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
  matchedAddress: string;
} | null> {
  const normalized = normalizeInboundRecipientList(toAddresses);
  if (!normalized.length) return null;

  const exact = await db.tenantAirbnbEmailIntegration.findFirst({
    where: {
      inboundEmailAddress: { in: normalized },
    },
    select: {
      id: true,
      organizationId: true,
      enabled: true,
      inboundEmailAddress: true,
    },
  });

  if (exact) {
    return {
      organizationId: exact.organizationId,
      integrationId: exact.id,
      enabled: exact.enabled,
      matchedAddress: exact.inboundEmailAddress,
    };
  }

  const configuredDomain = getConfiguredInboundEmailDomain().toLowerCase();
  const onConfiguredDomain = normalized.filter((address) =>
    address.endsWith(`@${configuredDomain}`),
  );
  if (!onConfiguredDomain.length) return null;

  const integrations = await db.tenantAirbnbEmailIntegration.findMany({
    select: {
      id: true,
      organizationId: true,
      enabled: true,
      inboundEmailAddress: true,
      organization: { select: { id: true, name: true } },
    },
  });

  for (const candidate of onConfiguredDomain) {
    const candidateLocal = getInboundLocalPart(candidate);
    if (!candidateLocal) continue;

    for (const row of integrations) {
      const aligned = await alignInboundEmailAddressWithEnv(
        row.organization,
        row.inboundEmailAddress,
      );
      const alignedLower = aligned.toLowerCase();

      if (alignedLower === candidate) {
        return {
          organizationId: row.organizationId,
          integrationId: row.id,
          enabled: row.enabled,
          matchedAddress: alignedLower,
        };
      }

      if (getInboundLocalPart(alignedLower) === candidateLocal) {
        if (alignedLower !== candidate) {
          await db.tenantAirbnbEmailIntegration.update({
            where: { id: row.id },
            data: { inboundEmailAddress: candidate },
          });
        }
        return {
          organizationId: row.organizationId,
          integrationId: row.id,
          enabled: row.enabled,
          matchedAddress: candidate,
        };
      }
    }
  }

  return null;
}

/** Siempre que el webhook identifica el tenant (antes de fetch/process). */
export async function recordIntegrationInboundReceived(
  integrationId: string,
): Promise<void> {
  await db.tenantAirbnbEmailIntegration.update({
    where: { id: integrationId },
    data: { lastEmailReceivedAt: new Date() },
  });
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
