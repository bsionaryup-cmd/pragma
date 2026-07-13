import { db } from "@/lib/db";
import { clamp, round2 } from "../lib/math";

export async function recomputeStoreHealthScore(storeId: string) {
  const [products, profiles, supplierProfiles, sales7, sales30] = await Promise.all([
    db.retailProduct.findMany({
      where: { storeId, deletedAt: null, status: "ACTIVE" },
      select: { id: true, stock: true, minStock: true, idealStock: true, cost: true, price: true },
    }),
    db.retailProductIntelProfile.findMany({ where: { storeId } }),
    db.retailSupplierIntelProfile.findMany({ where: { storeId } }),
    db.retailSale.aggregate({
      where: {
        storeId,
        status: "COMPLETED",
        createdAt: { gte: new Date(Date.now() - 7 * 86400000) },
      },
      _sum: { total: true },
    }),
    db.retailSale.aggregate({
      where: {
        storeId,
        status: "COMPLETED",
        createdAt: { gte: new Date(Date.now() - 30 * 86400000) },
      },
      _sum: { total: true },
    }),
  ]);

  const total = products.length || 1;
  const criticalCount = products.filter((p) => p.stock <= p.minStock).length;
  const overstockCount = profiles.filter(
    (p) => p.suggestedAction === "OVERSTOCKED" || p.suggestedAction === "PROMOTE",
  ).length;
  const deadStockCount = profiles.filter(
    (p) => p.suggestedAction === "NO_ROTATION" || Number(p.deadStockScore) >= 1,
  ).length;

  const coverageVals = profiles
    .map((p) => (p.daysOfCover != null ? Number(p.daysOfCover) : null))
    .filter((v): v is number => v !== null);
  const avgCover = coverageVals.length
    ? coverageVals.reduce((s, n) => s + n, 0) / coverageVals.length
    : 14;

  const margins = products.map((p) => {
    const price = Number(p.price);
    return price > 0 ? (price - Number(p.cost)) / price : 0;
  });
  const avgMargin = margins.length
    ? margins.reduce((s, n) => s + n, 0) / margins.length
    : 0;

  const inventoryHealth = clamp(
    Math.round(100 - (criticalCount / total) * 100),
    0,
    100,
  );
  const coverageScore = clamp(Math.round((avgCover / 14) * 70), 0, 100);
  const marginScore = clamp(Math.round(avgMargin * 100), 0, 100);
  const supplierScore = supplierProfiles.length
    ? clamp(
        Math.round(
          (supplierProfiles.reduce((s, p) => s + Number(p.reliabilityScore), 0) /
            supplierProfiles.length) *
            100,
        ),
        0,
        100,
      )
    : 70;

  const sales7n = Number(sales7._sum.total ?? 0);
  const sales30n = Number(sales30._sum.total ?? 0);
  const expected7 = sales30n / 4.3;
  const salesTrendScore =
    expected7 <= 0
      ? sales7n > 0
        ? 80
        : 50
      : clamp(Math.round((sales7n / expected7) * 70), 0, 100);

  const score = clamp(
    Math.round(
      inventoryHealth * 0.25 +
        coverageScore * 0.2 +
        (100 - clamp((overstockCount / total) * 100, 0, 100)) * 0.1 +
        marginScore * 0.15 +
        (100 - clamp((deadStockCount / total) * 100, 0, 100)) * 0.1 +
        supplierScore * 0.1 +
        salesTrendScore * 0.1,
    ),
    0,
    100,
  );

  const summaryJson = {
    message:
      score >= 80
        ? "Tienda saludable"
        : score >= 60
          ? "Atención operativa recomendada"
          : "Requiere acción prioritaria",
    criticalCount,
    overstockCount,
    deadStockCount,
    avgCover: round2(avgCover),
  };

  return db.retailStoreHealthScore.upsert({
    where: { storeId },
    create: {
      storeId,
      score,
      inventoryHealth,
      coverageScore,
      criticalCount,
      overstockCount,
      marginScore,
      deadStockCount,
      supplierScore,
      salesTrendScore,
      summaryJson,
      computedAt: new Date(),
    },
    update: {
      score,
      inventoryHealth,
      coverageScore,
      criticalCount,
      overstockCount,
      marginScore,
      deadStockCount,
      supplierScore,
      salesTrendScore,
      summaryJson,
      computedAt: new Date(),
    },
  });
}
