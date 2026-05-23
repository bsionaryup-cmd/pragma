import { OrganizationIntegrationProvider } from "@prisma/client";
import { db } from "@/lib/db";
import { isPriceLabsSchemaDriftError } from "@/services/integrations/pricelabs/pricelabs-prisma-guard";
import { isPriceLabsSchemaReady } from "@/services/integrations/pricelabs/pricelabs-schema";
import { requirePriceLabsOrganizationId } from "@/services/integrations/pricelabs/pricelabs-org-context";

const LOCK_STALE_MS = 5 * 60 * 1000;
const PRICELABS = OrganizationIntegrationProvider.PRICELABS;

function orgWhere(organizationId: string) {
  return {
    organizationId_provider: {
      organizationId,
      provider: PRICELABS,
    },
  } as const;
}

export async function acquirePriceLabsSyncLock(
  organizationId?: string,
): Promise<boolean> {
  const orgId = organizationId ?? requirePriceLabsOrganizationId();
  if (!(await isPriceLabsSchemaReady())) return true;

  const now = new Date();
  const staleBefore = new Date(now.getTime() - LOCK_STALE_MS);

  try {
    const row = await db.organizationIntegration.findUnique({
      where: orgWhere(orgId),
      select: { syncInProgressAt: true },
    });

    if (row?.syncInProgressAt && row.syncInProgressAt > staleBefore) {
      return false;
    }

    await db.organizationIntegration.upsert({
      where: orgWhere(orgId),
      create: {
        organizationId: orgId,
        provider: PRICELABS,
        syncInProgressAt: now,
      },
      update: { syncInProgressAt: now },
    });
    return true;
  } catch (error) {
    if (isPriceLabsSchemaDriftError(error)) return true;
    throw error;
  }
}

export async function releasePriceLabsSyncLock(
  organizationId?: string,
): Promise<void> {
  const orgId = organizationId ?? requirePriceLabsOrganizationId();
  if (!(await isPriceLabsSchemaReady())) return;

  try {
    await db.organizationIntegration.update({
      where: orgWhere(orgId),
      data: { syncInProgressAt: null },
    });
  } catch (error) {
    if (isPriceLabsSchemaDriftError(error)) return;
    throw error;
  }
}

export async function isPriceLabsSyncInProgress(
  organizationId?: string,
): Promise<boolean> {
  const orgId = organizationId ?? requirePriceLabsOrganizationId();
  if (!(await isPriceLabsSchemaReady())) return false;

  try {
    const row = await db.organizationIntegration.findUnique({
      where: orgWhere(orgId),
      select: { syncInProgressAt: true },
    });
    if (!row?.syncInProgressAt) return false;
    const staleBefore = new Date(Date.now() - LOCK_STALE_MS);
    return row.syncInProgressAt > staleBefore;
  } catch (error) {
    if (isPriceLabsSchemaDriftError(error)) return false;
    throw error;
  }
}

export async function runWithPriceLabsSyncLock<T>(
  fn: () => Promise<T>,
  organizationId?: string,
): Promise<{ ok: true; value: T } | { ok: false; message: string }> {
  const locked = await acquirePriceLabsSyncLock(organizationId);
  if (!locked) {
    return { ok: false, message: "Sincronización PriceLabs ya en curso" };
  }
  try {
    return { ok: true, value: await fn() };
  } finally {
    await releasePriceLabsSyncLock(organizationId);
  }
}
