import type { Prisma, RetailIntelAction, RetailIntelPriority } from "@prisma/client";
import { db } from "@/lib/db";
import {
  addDays,
  clamp,
  daysAgoBogota,
  round2,
  round4,
  startOfBogotaDay,
} from "../lib/math";
import { scoreSupplierOption } from "../lib/briefing";
import { getProductQtyBias } from "./learning.service";

type Tx = Prisma.TransactionClient | typeof db;

function sumQty(rows: Array<{ qtySold: number }>) {
  return rows.reduce((s, r) => s + r.qtySold, 0);
}

function classifyAction(input: {
  stock: number;
  minStock: number;
  idealStock: number;
  avg7: number;
  avg30: number;
  daysOfCover: number | null;
  leadTimeDays: number;
}): { action: RetailIntelAction; priority: RetailIntelPriority; reorderQty: number } {
  const targetCover = Math.max(14, input.leadTimeDays + 7);
  const velocity = input.avg7 > 0 ? input.avg7 : input.avg30;
  const daysOfCover =
    input.daysOfCover ?? (velocity > 0 ? input.stock / velocity : null);

  if (input.stock <= 0 || input.stock <= input.minStock) {
    const qty = Math.max(
      1,
      input.idealStock > 0 ? input.idealStock - input.stock : Math.ceil(velocity * targetCover),
    );
    return { action: "BUY_NOW", priority: "CRITICAL", reorderQty: qty };
  }

  if (daysOfCover !== null && daysOfCover <= input.leadTimeDays + 3) {
    const qty = Math.max(1, Math.ceil(velocity * targetCover - input.stock));
    return { action: "BUY_NOW", priority: "HIGH", reorderQty: qty };
  }

  if (daysOfCover !== null && daysOfCover <= targetCover) {
    const qty = Math.max(1, Math.ceil(velocity * targetCover - input.stock));
    return { action: "BUY_SOON", priority: "MEDIUM", reorderQty: qty };
  }

  if (velocity <= 0 && input.stock > Math.max(input.minStock, 0)) {
    if (input.stock > Math.max(input.idealStock, input.minStock) * 1.5) {
      return { action: "OVERSTOCKED", priority: "LOW", reorderQty: 0 };
    }
    return { action: "NO_ROTATION", priority: "LOW", reorderQty: 0 };
  }

  if (input.avg7 > 0 && input.avg30 > 0 && input.avg7 / input.avg30 >= 1.3) {
    if (daysOfCover !== null && daysOfCover < targetCover * 1.2) {
      const qty = Math.max(1, Math.ceil(velocity * (targetCover + 7) - input.stock));
      return { action: "HIGH_ROTATION", priority: "MEDIUM", reorderQty: qty };
    }
    return { action: "INCREASE_STOCK_TARGET", priority: "LOW", reorderQty: 0 };
  }

  if (input.avg7 > 0 && input.avg30 > 0 && input.avg7 / input.avg30 <= 0.7) {
    return { action: "DECREASE_STOCK_TARGET", priority: "LOW", reorderQty: 0 };
  }

  if (
    input.idealStock > 0 &&
    input.stock > input.idealStock * 1.5 &&
    (daysOfCover === null || daysOfCover > targetCover * 2)
  ) {
    return { action: "PROMOTE", priority: "LOW", reorderQty: 0 };
  }

  return { action: "WAIT", priority: "LOW", reorderQty: 0 };
}

export async function recomputeProductProfile(tx: Tx, storeId: string, productId: string) {
  const product = await tx.retailProduct.findFirst({
    where: { id: productId, storeId, deletedAt: null },
    include: {
      supplierProducts: {
        include: { supplier: true },
        orderBy: { cost: "asc" },
      },
    },
  });
  if (!product) return null;

  const since90 = daysAgoBogota(90);
  const demand = await tx.retailProductDemandDay.findMany({
    where: { storeId, productId, day: { gte: since90 } },
    orderBy: { day: "asc" },
  });

  const now = startOfBogotaDay();
  const window = (days: number) =>
    demand.filter((row) => row.day >= daysAgoBogota(days - 1, now));

  const avg7 = round4(sumQty(window(7)) / 7);
  const avg14 = round4(sumQty(window(14)) / 14);
  const avg30 = round4(sumQty(window(30)) / 30);
  const avg90 = round4(sumQty(window(90)) / 90);
  const avgWeekly = round4(avg7 * 7);
  const avgMonthly = round4(avg30 * 30);

  const slope =
    avg30 > 0 ? round4((avg7 - avg30) / avg30) : avg7 > 0 ? 1 : 0;
  const demandTrend = slope >= 0.3 ? "UP" : slope <= -0.3 ? "DOWN" : "FLAT";

  const salesByMonth: Record<string, number> = {};
  const salesByDow: Record<string, number> = {};
  for (const row of demand) {
    const month = String(row.day.getUTCMonth() + 1);
    salesByMonth[month] = (salesByMonth[month] ?? 0) + row.qtySold;
    const dow = String(row.day.getUTCDay());
    salesByDow[dow] = (salesByDow[dow] ?? 0) + row.qtySold;
  }

  const velocity = avg7 > 0 ? avg7 : avg30;
  const daysOfCover = velocity > 0 ? round2(product.stock / velocity) : null;
  const daysToStockoutEst =
    daysOfCover !== null ? Math.max(0, Math.floor(daysOfCover)) : null;

  const activeLinks = product.supplierProducts.filter(
    (row) => row.supplier.deletedAt === null && row.supplier.status === "ACTIVE",
  );
  const supplierIds = activeLinks.map((l) => l.supplierId);
  const supplierProfiles = supplierIds.length
    ? await tx.retailSupplierIntelProfile.findMany({
        where: { storeId, supplierId: { in: supplierIds } },
      })
    : [];
  const reliabilityBySupplier = new Map(
    supplierProfiles.map((p) => [
      p.supplierId,
      { reliability: Number(p.reliabilityScore), onTime: Number(p.onTimeRate) },
    ]),
  );

  let bestLink = activeLinks[0] ?? null;
  let bestScore = -1;
  let pickReason: string | null = null;
  for (const link of activeLinks) {
    const rel = reliabilityBySupplier.get(link.supplierId);
    const score = scoreSupplierOption({
      leadTimeDays: link.leadTimeDays || link.supplier.leadTimeDays || 3,
      cost: Number(link.cost),
      reliabilityScore: rel?.reliability ?? 0.7,
      onTimeRate: rel?.onTime ?? 0.7,
    });
    // Prefer primary on ties (stable, not random).
    const tieBreak =
      link.supplierId === product.primarySupplierId ? 0.0001 : 0;
    if (score + tieBreak > bestScore) {
      bestScore = score;
      bestLink = link;
    }
  }

  if (bestLink) {
    const lead = bestLink.leadTimeDays || bestLink.supplier.leadTimeDays || 3;
    const cost = Number(bestLink.cost);
    pickReason = `Proveedor elegido: ${bestLink.supplier.name} (entrega ${lead}d, costo ${cost}).`;
    if (
      product.primarySupplierId &&
      bestLink.supplierId !== product.primarySupplierId
    ) {
      pickReason = `Mejor opción vs proveedor habitual: ${bestLink.supplier.name} (menor tiempo/costo y mejor cumplimiento).`;
    }
  }

  const supplierId =
    bestLink?.supplierId ?? product.primarySupplierId ?? null;
  const leadTimeDays =
    bestLink?.leadTimeDays ||
    bestLink?.supplier.leadTimeDays ||
    3;

  const price = Number(product.price);
  const cost = Number(product.cost);
  const grossMarginPct = price > 0 ? round4((price - cost) / price) : 0;

  const classified = classifyAction({
    stock: product.stock,
    minStock: product.minStock,
    idealStock: product.idealStock,
    avg7,
    avg30,
    daysOfCover,
    leadTimeDays,
  });

  const unitCost = Number(bestLink?.cost ?? product.cost);
  const moq = bestLink?.minPurchaseQty ?? 1;
  const bias = await getProductQtyBias(storeId, productId);
  const biasedQty =
    classified.reorderQty > 0
      ? Math.max(1, Math.round(classified.reorderQty * bias))
      : 0;
  const suggestedReorderQty = biasedQty > 0 ? Math.max(biasedQty, moq) : 0;

  let action = classified.action;
  if (product.stock <= 0) action = "CRITICAL";
  else if (daysOfCover !== null && daysOfCover <= 7 && action === "BUY_SOON") {
    action = "RUNNING_OUT";
  } else if (
    pickReason?.includes("Mejor opción") &&
    suggestedReorderQty > 0
  ) {
    action = "SWITCH_SUPPLIER";
  }

  // Persist pick reason in unused class fields without migration (read path uses action+supplier).
  void pickReason;

  const confidence = clamp(sumQty(window(30)) / 30, 0, 1);
  const deadStockScore =
    avg30 <= 0 && product.stock > 0 ? clamp(product.stock / Math.max(product.idealStock, 1), 0, 5) : 0;

  const estimatedStockoutDate =
    daysToStockoutEst !== null ? addDays(now, daysToStockoutEst) : null;
  const recommendedBuyDate =
    suggestedReorderQty > 0
      ? addDays(now, Math.max(0, (daysToStockoutEst ?? 7) - leadTimeDays))
      : null;

  const data = {
    storeId,
    productId,
    avgDailySales7: avg7,
    avgDailySales14: avg14,
    avgDailySales30: avg30,
    avgDailySales90: avg90,
    avgWeeklySales: avgWeekly,
    avgMonthlySales: avgMonthly,
    salesByMonthJson: salesByMonth,
    salesByDowJson: salesByDow,
    demandTrendSlope: slope,
    demandTrend,
    daysOfCover,
    daysToStockoutEst,
    stockoutDays30: product.stock <= 0 ? 1 : 0,
    grossMarginPct,
    lastCost: cost,
    lastPrice: price,
    suggestedReorderQty,
    suggestedAction: action,
    priority: classified.priority,
    confidence: round4(confidence),
    deadStockScore: round4(deadStockScore),
    recommendedBuyDate,
    estimatedStockoutDate,
    estimatedCoverageDays: daysToStockoutEst,
    estimatedCost: round2(suggestedReorderQty * unitCost),
    supplierId,
    abcClass: pickReason ? "PICK" : null,
    xyzClass: pickReason,
    computedAt: new Date(),
  };

  return tx.retailProductIntelProfile.upsert({
    where: { productId },
    create: data,
    update: data,
  });
}

export async function applySaleDemandIncrement(
  tx: Tx,
  storeId: string,
  items: Array<{ productId: string; quantity: number; unitPrice: number; unitCost: number }>,
  day = startOfBogotaDay(),
) {
  for (const item of items) {
    const existing = await tx.retailProductDemandDay.findUnique({
      where: { productId_day: { productId: item.productId, day } },
    });
    if (existing) {
      await tx.retailProductDemandDay.update({
        where: { id: existing.id },
        data: {
          qtySold: { increment: item.quantity },
          revenue: { increment: round2(item.unitPrice * item.quantity) },
          cost: { increment: round2(item.unitCost * item.quantity) },
        },
      });
    } else {
      await tx.retailProductDemandDay.create({
        data: {
          storeId,
          productId: item.productId,
          day,
          qtySold: item.quantity,
          revenue: round2(item.unitPrice * item.quantity),
          cost: round2(item.unitCost * item.quantity),
        },
      });
    }
    await recomputeProductProfile(tx, storeId, item.productId);
  }
}
