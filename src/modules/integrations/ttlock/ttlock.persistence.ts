import type { TTLockIntegration } from "@prisma/client";
import { TTLockEnvironment, TTLockIntegrationStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentTenantContext } from "@/lib/platform/tenant-context";
import type { TenantDataScope } from "@/lib/platform/tenant-data-scope";
import { shouldAllowTTLockIntegrationMutation } from "@/modules/integrations/ttlock/ttlock-mutation-policy";
import {
  rethrowUnlessTTLockSchemaDrift,
} from "@/services/integrations/ttlock/ttlock-prisma-guard";

export { shouldAllowTTLockIntegrationMutation } from "@/modules/integrations/ttlock/ttlock-mutation-policy";

async function isActivePlatformImpersonation(): Promise<boolean> {
  try {
    const ctx = await getCurrentTenantContext();
    return Boolean(ctx?.isImpersonating);
  } catch {
    return false;
  }
}

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

/** Read-only org/user lookup — never creates or reassigns rows. */
export async function resolveTTLockIntegrationForScope(
  scope: TenantDataScope,
): Promise<TTLockIntegration | null> {
  try {
    if (scope.organizationId) {
      return getTTLockIntegrationForOrganization(scope.organizationId);
    }
    return getTTLockIntegrationForUser(scope.userId);
  } catch (error) {
    if (isTTLockSchemaMissing(error)) return null;
    rethrowUnlessTTLockSchemaDrift(error);
    throw error;
  }
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

      const impersonating = await isActivePlatformImpersonation();
      if (
        !shouldAllowTTLockIntegrationMutation({ isImpersonating: impersonating })
      ) {
        throw new Error(
          "TTLock no está configurado para este tenant (impersonación de solo lectura)",
        );
      }

      const legacy = await getTTLockIntegrationForUser(scope.userId);
      if (legacy) {
        // Never steal a row already bound to a different organization.
        if (
          legacy.organizationId != null &&
          legacy.organizationId !== scope.organizationId
        ) {
          throw new Error(
            "TTLock del usuario ya pertenece a otra organización",
          );
        }
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

    const impersonating = await isActivePlatformImpersonation();
    if (
      !shouldAllowTTLockIntegrationMutation({ isImpersonating: impersonating })
    ) {
      const existing = await getTTLockIntegrationForUser(scope.userId);
      if (existing) return existing;
      throw new Error(
        "TTLock no está configurado para este tenant (impersonación de solo lectura)",
      );
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
        data: {
          integrationId: byUser.id,
          generateAfterGuestRegistration: true,
          requireManualApproval: false,
          autoSendCode: true,
        },
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
