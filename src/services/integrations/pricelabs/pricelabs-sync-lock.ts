import { OrganizationIntegrationProvider } from "@prisma/client";
import { db } from "@/lib/db";
import { isPriceLabsSchemaDriftError } from "@/services/integrations/pricelabs/pricelabs-prisma-guard";
import { isPriceLabsSchemaReady } from "@/services/integrations/pricelabs/pricelabs-schema";
import { requirePriceLabsOrganizationId } from "@/services/integrations/pricelabs/pricelabs-org-context";

/** Must stay below typical serverless kill windows so orphans become reclaimable. */
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

async function clearStaleLockRow(
  organizationId: string,
  staleBefore: Date,
): Promise<void> {
  try {
    await db.organizationIntegration.updateMany({
      where: {
        organizationId,
        provider: PRICELABS,
        syncInProgressAt: { lte: staleBefore },
      },
      data: { syncInProgressAt: null },
    });
  } catch (error) {
    if (isPriceLabsSchemaDriftError(error)) return;
    console.warn("[pricelabs] clearStaleLockRow failed", error);
  }
}

/**
 * Acquire org-level PriceLabs sync lock.
 * Reclaims stale/orphaned locks (crash/timeout without release).
 */
export async function acquirePriceLabsSyncLock(
  organizationId?: string,
): Promise<boolean> {
  const orgId = organizationId ?? requirePriceLabsOrganizationId();
  if (!(await isPriceLabsSchemaReady())) return true;

  const now = new Date();
  const staleBefore = new Date(now.getTime() - LOCK_STALE_MS);

  try {
    await clearStaleLockRow(orgId, staleBefore);

    // Atomic reclaim: only one writer wins when lock is free or stale-cleared.
    const claimed = await db.organizationIntegration.updateMany({
      where: {
        organizationId: orgId,
        provider: PRICELABS,
        syncInProgressAt: null,
      },
      data: { syncInProgressAt: now },
    });
    if (claimed.count === 1) return true;

    const row = await db.organizationIntegration.findUnique({
      where: orgWhere(orgId),
      select: { syncInProgressAt: true },
    });

    if (!row) {
      await db.organizationIntegration.create({
        data: {
          organizationId: orgId,
          provider: PRICELABS,
          syncInProgressAt: now,
        },
      });
      return true;
    }

    if (row.syncInProgressAt && row.syncInProgressAt > staleBefore) {
      return false;
    }

    // Stale or null after race — take over.
    await db.organizationIntegration.update({
      where: orgWhere(orgId),
      data: { syncInProgressAt: now },
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
    await db.organizationIntegration.updateMany({
      where: {
        organizationId: orgId,
        provider: PRICELABS,
      },
      data: { syncInProgressAt: null },
    });
  } catch (error) {
    if (isPriceLabsSchemaDriftError(error)) return;
    // Never throw from release — orphaned locks are reclaimed by stale TTL.
    console.error("[pricelabs] releasePriceLabsSyncLock failed", error);
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
    if (row.syncInProgressAt <= staleBefore) {
      await clearStaleLockRow(orgId, staleBefore);
      return false;
    }
    return true;
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
    return {
      ok: false,
      message:
        "Sincronización PriceLabs ya en curso. Espera un momento e inténtalo de nuevo.",
    };
  }
  try {
    return { ok: true, value: await fn() };
  } finally {
    await releasePriceLabsSyncLock(organizationId);
  }
}
