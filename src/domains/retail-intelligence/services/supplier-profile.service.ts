import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { round2, round4 } from "../lib/math";

type Tx = Prisma.TransactionClient | typeof db;

function percentile(sorted: number[], p: number) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[idx]!;
}

export async function recomputeSupplierProfile(tx: Tx, storeId: string, supplierId: string) {
  const supplier = await tx.retailSupplier.findFirst({
    where: { id: supplierId, storeId, deletedAt: null },
  });
  if (!supplier) return null;

  const [productCount, orders] = await Promise.all([
    tx.retailProduct.count({
      where: {
        storeId,
        deletedAt: null,
        OR: [{ primarySupplierId: supplierId }, { secondarySupplierId: supplierId }],
      },
    }),
    tx.retailPurchaseOrder.findMany({
      where: {
        storeId,
        supplierId,
        status: { in: ["RECEIVED", "APPROVED", "SENT"] },
      },
      include: { items: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const received = orders.filter((o) => o.status === "RECEIVED" && o.receivedAt);
  const leadTimes = received
    .map((o) => {
      const ms = (o.receivedAt!.getTime() - o.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      return Math.max(0, ms);
    })
    .sort((a, b) => a - b);

  const declared = supplier.leadTimeDays || 0;
  const avgLead = leadTimes.length
    ? round2(leadTimes.reduce((s, n) => s + n, 0) / leadTimes.length)
    : declared;
  const p50 = leadTimes.length ? round2(percentile(leadTimes, 0.5)) : declared;
  const p90 = leadTimes.length ? round2(percentile(leadTimes, 0.9)) : declared;

  let orderedQty = 0;
  let receivedQty = 0;
  let onTime = 0;
  for (const order of received) {
    for (const item of order.items) {
      orderedQty += item.quantity;
      receivedQty += item.receivedQuantity;
    }
    const lead = (order.receivedAt!.getTime() - order.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (lead <= Math.max(declared, 1) + 1) onTime += 1;
  }

  const fillRate = orderedQty > 0 ? round4(receivedQty / orderedQty) : 1;
  const onTimeRate = received.length ? round4(onTime / received.length) : 1;
  const totals = orders.map((o) => Number(o.totalCost));
  const lifetime = round2(totals.reduce((s, n) => s + n, 0));
  const avgOrder = totals.length ? round2(lifetime / totals.length) : 0;
  const last = orders[0];
  const frequency =
    orders.length >= 2
      ? round2(
          (orders[0]!.createdAt.getTime() - orders[orders.length - 1]!.createdAt.getTime()) /
            (1000 * 60 * 60 * 24) /
            (orders.length - 1),
        )
      : 0;

  const dowCounts: Record<string, number> = {};
  for (const order of received) {
    const dow = String(order.receivedAt!.getUTCDay());
    dowCounts[dow] = (dowCounts[dow] ?? 0) + 1;
  }

  const reliabilityScore = round4(0.5 * onTimeRate + 0.5 * Math.min(fillRate, 1));

  const data = {
    storeId,
    supplierId,
    productCount,
    avgLeadTimeDaysObserved: avgLead,
    leadTimeP50: p50,
    leadTimeP90: p90,
    preferredDeliveryDowsJson: dowCounts,
    onTimeRate,
    fillRate,
    orderFrequencyDays: frequency,
    lastOrderAt: last?.createdAt ?? null,
    lastOrderTotal: last ? Number(last.totalCost) : 0,
    avgOrderTotal: avgOrder,
    lifetimePurchaseTotal: lifetime,
    reliabilityScore,
    computedAt: new Date(),
  };

  return tx.retailSupplierIntelProfile.upsert({
    where: { supplierId },
    create: data,
    update: data,
  });
}
