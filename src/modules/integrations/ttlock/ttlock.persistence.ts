import type { TTLockIntegration } from "@prisma/client";
import { TTLockEnvironment, TTLockIntegrationStatus } from "@prisma/client";
import { db } from "@/lib/db";
import type { TenantDataScope } from "@/lib/platform/tenant-data-scope";
import {
  rethrowUnlessTTLockSchemaDrift,
} from "@/services/integrations/ttlock/ttlock-prisma-guard";

function isTTLockSchemaMissing(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { code?: string }).code;
  return code === "P2021" || code === "P2022";
}

export function hasTTLockOrganizationColumn(): boolean {
  return Boolean(
    (db.tTLockIntegration as { findFirst?: unknown })?.findFirst,
  );
}

export async function getTTLockIntegrationForOrganization(
  organizationId: string,
): Promise<TTLockIntegration | null> {
  try {
    return await db.tTLockIntegration.findUnique({
      where: { organizationId },
      include: { automationSettings: true },
    });
  } catch (error) {
    if (isTTLockSchemaMissing(error)) return null;
    rethrowUnlessTTLockSchemaDrift(error);
    throw error;
  }
}

export async function getTTLockIntegrationForUser(
  userId: string,
): Promise<TTLockIntegration | null> {
  try {
    return await db.tTLockIntegration.findUnique({
      where: { userId },
      include: { automationSettings: true },
    });
  } catch (error) {
    if (isTTLockSchemaMissing(error)) return null;
    rethrowUnlessTTLockSchemaDrift(error);
    throw error;
  }
}

export async function resolveOrganizationIdForProperty(
  propertyId: string,
): Promise<string | null> {
  const property = await db.property.findUnique({
    where: { id: propertyId },
    select: { organizationId: true, ownerId: true },
  });
  if (!property) return null;
  if (property.organizationId) return property.organizationId;
  const owner = await db.user.findUnique({
    where: { id: property.ownerId },
    select: { organizationId: true },
  });
  return owner?.organizationId ?? null;
}

export async function resolveTTLockIntegrationForProperty(
  propertyId: string,
): Promise<TTLockIntegration | null> {
  const property = await db.property.findUnique({
    where: { id: propertyId },
    select: { organizationId: true, ownerId: true },
  });
  if (!property) return null;

  if (property.organizationId) {
    const byOrg = await getTTLockIntegrationForOrganization(
      property.organizationId,
    );
    if (byOrg?.isActive !== false) return byOrg;
  }

  return getTTLockIntegrationForUser(property.ownerId);
}

export async function resolveTTLockAutomationSettingsForProperty(
  propertyId: string,
) {
  const integration = await resolveTTLockIntegrationForProperty(propertyId);
  if (!integration) return null;
  return db.tTLockAutomationSettings.findUnique({
    where: { integrationId: integration.id },
  });
}

/** Org-first integration ensure; falls back to legacy user-scoped row. */
export async function ensureTTLockIntegrationForScope(
  scope: TenantDataScope,
): Promise<TTLockIntegration> {
  try {
    if (scope.organizationId) {
      const existing = await getTTLockIntegrationForOrganization(
        scope.organizationId,
      );
      if (existing) return existing;

      const legacy = await getTTLockIntegrationForUser(scope.userId);
      if (legacy) {
        return db.tTLockIntegration.update({
          where: { id: legacy.id },
          data: {
            organizationId: scope.organizationId,
            configuredById: scope.userId,
          },
          include: { automationSettings: true },
        });
      }

      return db.tTLockIntegration.create({
        data: {
          userId: scope.userId,
          organizationId: scope.organizationId,
          configuredById: scope.userId,
          status: TTLockIntegrationStatus.NOT_CONNECTED,
          environment: TTLockEnvironment.PRODUCTION,
          automationSettings: {
            create: {
              generateAfterGuestRegistration: true,
              requireManualApproval: false,
            },
          },
        },
        include: { automationSettings: true },
      });
    }

    const byUser = await db.tTLockIntegration.upsert({
      where: { userId: scope.userId },
      create: {
        userId: scope.userId,
        configuredById: scope.userId,
        status: TTLockIntegrationStatus.NOT_CONNECTED,
        environment: TTLockEnvironment.PRODUCTION,
        automationSettings: {
          create: {
            generateAfterGuestRegistration: true,
            requireManualApproval: false,
          },
        },
      },
      update: {},
      include: { automationSettings: true },
    });

    if (!byUser.automationSettings) {
      await db.tTLockAutomationSettings.create({
        data: { integrationId: byUser.id },
      });
    }

    return db.tTLockIntegration.findUniqueOrThrow({
      where: { id: byUser.id },
      include: { automationSettings: true },
    });
  } catch (error) {
    rethrowUnlessTTLockSchemaDrift(error);
    throw error;
  }
}

export async function attachOrganizationToIntegration(
  integrationId: string,
  organizationId: string,
  configuredById: string,
): Promise<void> {
  await db.tTLockIntegration.update({
    where: { id: integrationId },
    data: { organizationId, configuredById },
  });
}

export function isTTLockIntegrationConnected(
  integration: Pick<TTLockIntegration, "status" | "isActive">,
): boolean {
  if (integration.isActive === false) return false;
  return (
    integration.status === TTLockIntegrationStatus.CONNECTED ||
    integration.status === TTLockIntegrationStatus.READY
  );
}
