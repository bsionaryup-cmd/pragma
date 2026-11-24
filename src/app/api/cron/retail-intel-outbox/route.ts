/**
 * Inventory Intelligence outbox cron — safety net (Hobby: daily).
 * Primary path: event enqueue + scheduleIntelOutboxDrain() after retail writes.
 */
import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { db } from "@/lib/db";
import { drainIntelOutbox } from "@/domains/retail-intelligence";
import { bootstrapStoreIntelligence } from "@/domains/retail-intelligence";
import { recomputeStoreHealthScore } from "@/domains/retail-intelligence/services/health-score.service";
import { logIntelObs } from "@/domains/retail-intelligence/services/observability";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";



export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  logIntelObs("info", "cron_retail_intel_start", {});

  const drained = await drainIntelOutbox(200);

  const staleStores = await db.retailStore.findMany({
    where: { deletedAt: null, status: "ACTIVE" },
    select: { id: true },
    take: 50,
  });

  const bootstrapped: string[] = [];
  for (const store of staleStores) {
    const profile = await db.retailProductIntelProfile.findFirst({
      where: {
        storeId: store.id,
        computedAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      select: { id: true },
    });
    const empty = await db.retailProductIntelProfile.count({ where: { storeId: store.id } });
    if (profile || empty === 0) {
      await bootstrapStoreIntelligence(store.id);
      await recomputeStoreHealthScore(store.id);
      bootstrapped.push(store.id);
    }
  }

  logIntelObs("info", "cron_retail_intel_done", {
    drained,
    bootstrapped: bootstrapped.length,
  });

  return NextResponse.json({
    ok: true,
    drained,
    bootstrapped: bootstrapped.length,
  });
}
