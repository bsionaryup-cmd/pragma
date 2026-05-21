import { db } from "@/lib/db";
import { isPriceLabsSchemaDriftError } from "@/services/integrations/pricelabs/pricelabs-prisma-guard";
import { isPriceLabsSchemaReady } from "@/services/integrations/pricelabs/pricelabs-schema";

const SINGLETON_ID = "singleton";
const LOCK_STALE_MS = 5 * 60 * 1000;

export async function acquirePriceLabsSyncLock(): Promise<boolean> {
  if (!(await isPriceLabsSchemaReady())) return true;

  const now = new Date();
  const staleBefore = new Date(now.getTime() - LOCK_STALE_MS);

  try {
    const row = await db.priceLabsIntegration.findUnique({
      where: { id: SINGLETON_ID },
      select: { syncInProgressAt: true },
    });

    if (row?.syncInProgressAt && row.syncInProgressAt > staleBefore) {
      return false;
    }

    await db.priceLabsIntegration.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, syncInProgressAt: now },
      update: { syncInProgressAt: now },
    });
    return true;
  } catch (error) {
    if (isPriceLabsSchemaDriftError(error)) return true;
    throw error;
  }
}

export async function releasePriceLabsSyncLock(): Promise<void> {
  if (!(await isPriceLabsSchemaReady())) return;

  try {
    await db.priceLabsIntegration.update({
      where: { id: SINGLETON_ID },
      data: { syncInProgressAt: null },
    });
  } catch (error) {
    if (isPriceLabsSchemaDriftError(error)) return;
    throw error;
  }
}

export async function isPriceLabsSyncInProgress(): Promise<boolean> {
  if (!(await isPriceLabsSchemaReady())) return false;

  try {
    const row = await db.priceLabsIntegration.findUnique({
      where: { id: SINGLETON_ID },
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
): Promise<{ ok: true; value: T } | { ok: false; message: string }> {
  const locked = await acquirePriceLabsSyncLock();
  if (!locked) {
    return { ok: false, message: "Sincronización PriceLabs ya en curso" };
  }
  try {
    return { ok: true, value: await fn() };
  } finally {
    await releasePriceLabsSyncLock();
  }
}
