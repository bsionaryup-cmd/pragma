import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { drainIntelOutbox } from "@/domains/retail-intelligence";
import { bootstrapStoreIntelligence } from "@/domains/retail-intelligence";
import { recomputeStoreHealthScore } from "@/domains/retail-intelligence/services/health-score.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;
  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret;
}

/**
 * Inventory Intelligence worker: drain outbox + stale store catch-up.
 * Additive retail cron — does not touch PMS jobs.
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  return NextResponse.json({
    ok: true,
    drained,
    bootstrapped: bootstrapped.length,
  });
}
