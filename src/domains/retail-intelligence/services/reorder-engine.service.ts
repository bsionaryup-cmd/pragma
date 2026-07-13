import { db } from "@/lib/db";
import { generatePurchaseCode } from "@/lib/retail/codes";
import { roundMoney } from "@/lib/retail/money";
import { recomputeProductProfile } from "./product-profile.service";
import { recomputeSupplierProfile } from "./supplier-profile.service";

const BUY_ACTIONS = new Set([
  "BUY_NOW",
  "BUY_SOON",
  "CRITICAL",
  "RUNNING_OUT",
  "HIGH_ROTATION",
]);

/** Full profile recompute for cold start / nightly catch-up. */
export async function bootstrapStoreProfiles(storeId: string) {
  const products = await db.retailProduct.findMany({
    where: { storeId, deletedAt: null, status: "ACTIVE" },
    select: { id: true, primarySupplierId: true },
  });
  for (const product of products) {
    await recomputeProductProfile(db, storeId, product.id);
  }
  const supplierIds = [
    ...new Set(products.map((p) => p.primarySupplierId).filter(Boolean) as string[]),
  ];
  for (const supplierId of supplierIds) {
    await recomputeSupplierProfile(db, storeId, supplierId);
  }
}

/**
 * Rebuild active reorder plan + SUGGESTED POs grouped by supplier.
 * Assumes product/supplier profiles are already fresh for affected SKUs.
 */
export async function refreshStoreReorderPlan(storeId: string) {
  const profiles = await db.retailProductIntelProfile.findMany({
    where: { storeId },
    include: { product: true },
  });

  const buyLines = profiles.filter(
    (p) =>
      p.product.deletedAt === null &&
      p.product.status === "ACTIVE" &&
      BUY_ACTIONS.has(p.suggestedAction) &&
      p.suggestedReorderQty > 0,
  );

  return db.$transaction(async (tx) => {
    await tx.retailIntelReorderPlan.updateMany({
      where: { storeId, status: "ACTIVE" },
      data: { status: "SUPERSEDED" },
    });

    const plan = await tx.retailIntelReorderPlan.create({
      data: {
        storeId,
        status: "ACTIVE",
        version: 1,
        lineCount: buyLines.length,
        estimatedTotal: roundMoney(
          buyLines.reduce((s, l) => s + Number(l.estimatedCost), 0),
        ),
        computedAt: new Date(),
      },
    });

    const oldSuggested = await tx.retailPurchaseOrder.findMany({
      where: { storeId, status: "SUGGESTED", aiGenerated: true },
      select: { id: true },
    });
    if (oldSuggested.length) {
      await tx.retailPurchaseOrderItem.deleteMany({
        where: { purchaseOrderId: { in: oldSuggested.map((o) => o.id) } },
      });
      await tx.retailPurchaseOrder.deleteMany({
        where: { id: { in: oldSuggested.map((o) => o.id) } },
      });
    }

    const bySupplier = new Map<string, typeof buyLines>();
    for (const line of buyLines) {
      const key = line.supplierId ?? "__none__";
      const bucket = bySupplier.get(key) ?? [];
      bucket.push(line);
      bySupplier.set(key, bucket);
    }

    const createdOrders: string[] = [];

    for (const [key, lines] of bySupplier) {
      const supplierId = key === "__none__" ? null : key;
      const items = lines.map((line) => {
        const unitCost =
          Number(line.estimatedCost) > 0 && line.suggestedReorderQty > 0
            ? roundMoney(Number(line.estimatedCost) / line.suggestedReorderQty)
            : Number(line.product.cost);
        return {
          productId: line.productId,
          productName: line.product.name,
          quantity: line.suggestedReorderQty,
          unitCost,
          lineTotal: roundMoney(unitCost * line.suggestedReorderQty),
        };
      });
      const totalCost = roundMoney(items.reduce((s, i) => s + i.lineTotal, 0));
      const order = await tx.retailPurchaseOrder.create({
        data: {
          storeId,
          supplierId,
          code: generatePurchaseCode(),
          status: "SUGGESTED",
          aiGenerated: true,
          totalCost,
          notes: "Generado automáticamente por Inventory Intelligence",
          items: { create: items },
        },
      });
      createdOrders.push(order.id);

      for (const line of lines) {
        await tx.retailIntelReorderPlanLine.create({
          data: {
            planId: plan.id,
            storeId,
            productId: line.productId,
            supplierId,
            suggestedQty: line.suggestedReorderQty,
            unitCost:
              Number(line.estimatedCost) > 0 && line.suggestedReorderQty > 0
                ? roundMoney(Number(line.estimatedCost) / line.suggestedReorderQty)
                : Number(line.product.cost),
            estimatedCost: Number(line.estimatedCost),
            action: line.suggestedAction,
            priority: line.priority,
            daysOfCover: line.daysOfCover,
            estimatedStockoutDate: line.estimatedStockoutDate,
            recommendedBuyDate: line.recommendedBuyDate,
            purchaseOrderId: order.id,
          },
        });
      }
    }

    await tx.retailPurchaseSuggestion.updateMany({
      where: { storeId, status: "PENDING" },
      data: { status: "DISMISSED", resolvedAt: new Date() },
    });
    for (const line of buyLines) {
      const reason =
        line.suggestedAction === "CRITICAL" || line.product.stock <= 0
          ? "OUT_OF_STOCK"
          : line.product.stock <= line.product.minStock
            ? "LOW_STOCK"
            : line.suggestedAction === "HIGH_ROTATION"
              ? "HIGH_ROTATION"
              : "REORDER_CYCLE";
      await tx.retailPurchaseSuggestion.create({
        data: {
          storeId,
          productId: line.productId,
          supplierId: line.supplierId,
          suggestedQty: line.suggestedReorderQty,
          reason,
          status: "PENDING",
          daysOfStockRemaining: line.daysToStockoutEst,
          averageDailySales: line.avgDailySales7,
          estimatedCost: line.estimatedCost,
        },
      });
    }

    return { planId: plan.id, orderIds: createdOrders, lineCount: buyLines.length };
  });
}

export async function bootstrapStoreIntelligence(storeId: string) {
  await bootstrapStoreProfiles(storeId);
  return refreshStoreReorderPlan(storeId);
}
