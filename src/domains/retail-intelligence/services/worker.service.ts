import type { RetailIntelOutbox } from "@prisma/client";
import { db } from "@/lib/db";
import {
  applySaleDemandIncrement,
  recomputeProductProfile,
} from "./product-profile.service";
import { recomputeSupplierProfile } from "./supplier-profile.service";
import {
  bootstrapStoreIntelligence,
  refreshStoreReorderPlan,
} from "./reorder-engine.service";
import { recomputeStoreHealthScore } from "./health-score.service";
import { logIntelObs } from "./observability";

async function markDone(id: string) {
  await db.retailIntelOutbox.update({
    where: { id },
    data: { status: "DONE", processedAt: new Date() },
  });
}

async function markFailed(id: string, error: unknown, attempts: number) {
  await db.retailIntelOutbox.update({
    where: { id },
    data: {
      status: attempts >= 5 ? "FAILED" : "PENDING",
      attempts: { increment: 1 },
      lastError: error instanceof Error ? error.message : String(error),
    },
  });
}

async function processEvent(event: RetailIntelOutbox) {
  const payload = (event.payload ?? {}) as {
    items?: Array<{ productId: string; quantity: number; unitPrice: number; unitCost: number }>;
    supplierId?: string | null;
  };

  switch (event.type) {
    case "SALE_COMPLETED": {
      if (payload.items?.length) {
        await applySaleDemandIncrement(db, event.storeId, payload.items);
      } else {
        for (const productId of event.productIds) {
          await recomputeProductProfile(db, event.storeId, productId);
        }
      }
      break;
    }
    case "SALE_CANCELLED":
    case "STOCK_ADJUSTED":
    case "STOCK_TRANSFERRED":
    case "PRODUCT_UPDATED": {
      for (const productId of event.productIds) {
        await recomputeProductProfile(db, event.storeId, productId);
      }
      break;
    }
    case "PURCHASE_RECEIVED": {
      for (const productId of event.productIds) {
        await recomputeProductProfile(db, event.storeId, productId);
      }
      if (payload.supplierId) {
        await recomputeSupplierProfile(db, event.storeId, payload.supplierId);
      }
      break;
    }
    case "SUPPLIER_UPDATED": {
      if (event.entityId) {
        await recomputeSupplierProfile(db, event.storeId, event.entityId);
      }
      break;
    }
    case "REFRESH_STORE_PLAN": {
      // handled in batch after product events
      break;
    }
    default:
      break;
  }
}

/**
 * Drain pending outbox events. Product/supplier updates first, then one plan+health refresh per store.
 */
export async function drainIntelOutbox(limit = 100) {
  const pending = await db.retailIntelOutbox.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  if (!pending.length) {
    return { processed: 0, refreshedStores: [] as string[] };
  }

  const ids = pending.map((e) => e.id);
  await db.retailIntelOutbox.updateMany({
    where: { id: { in: ids } },
    data: { status: "PROCESSING" },
  });

  const storesNeedingRefresh = new Set<string>();
  let processed = 0;

  for (const event of pending) {
    try {
      if (event.type === "REFRESH_STORE_PLAN") {
        storesNeedingRefresh.add(event.storeId);
        await markDone(event.id);
        processed += 1;
        continue;
      }
      await processEvent(event);
      storesNeedingRefresh.add(event.storeId);
      await markDone(event.id);
      processed += 1;
    } catch (error) {
      await markFailed(event.id, error, event.attempts + 1);
      logIntelObs("error", "outbox_event_failed", {
        eventId: event.id,
        type: event.type,
        storeId: event.storeId,
        attempts: event.attempts + 1,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const refreshedStores: string[] = [];
  for (const storeId of storesNeedingRefresh) {
    try {
      await refreshStoreReorderPlan(storeId);
      await recomputeStoreHealthScore(storeId);
      refreshedStores.push(storeId);
      logIntelObs("info", "store_plan_refreshed", { storeId });
    } catch (error) {
      logIntelObs("warn", "store_plan_refresh_failed", {
        storeId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logIntelObs("info", "outbox_drain_complete", {
    processed,
    refreshed: refreshedStores.length,
    limit,
  });

  return { processed, refreshedStores };
}

/** Bootstrap / catch-up for a store when Pedidos opens and profiles are empty. */
export async function ensureStoreIntelligence(storeId: string) {
  const [profileCount, pending] = await Promise.all([
    db.retailProductIntelProfile.count({ where: { storeId } }),
    db.retailIntelOutbox.count({ where: { storeId, status: "PENDING" } }),
  ]);

  if (pending > 0) {
    await drainIntelOutbox(200);
  }

  if (profileCount === 0) {
    await bootstrapStoreIntelligence(storeId);
    await recomputeStoreHealthScore(storeId);
    return;
  }

  const stale = await db.retailProductIntelProfile.findFirst({
    where: {
      storeId,
      computedAt: { lt: new Date(Date.now() - 6 * 60 * 60 * 1000) },
    },
  });
  if (stale) {
    await bootstrapStoreIntelligence(storeId);
    await recomputeStoreHealthScore(storeId);
    return;
  }

  // Profiles exist but no active plan yet (e.g. after migrate before first plan build).
  const activePlan = await db.retailIntelReorderPlan.findFirst({
    where: { storeId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!activePlan) {
    await refreshStoreReorderPlan(storeId);
    await recomputeStoreHealthScore(storeId);
  }
}
