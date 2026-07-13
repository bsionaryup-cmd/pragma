import { db } from "@/lib/db";

export async function getAiDashboardInsights(storeId: string) {
  const [products, pendingSuggestions] = await Promise.all([
    db.retailProduct.findMany({
      where: { storeId, deletedAt: null, status: "ACTIVE" },
      select: { id: true, name: true, stock: true, minStock: true, idealStock: true },
      orderBy: { stock: "asc" },
    }),
    db.retailPurchaseSuggestion.findMany({
      where: { storeId, status: "PENDING" },
      include: { product: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sold = await db.retailSaleItem.groupBy({
    by: ["productId"],
    where: {
      productId: { not: null },
      sale: { storeId, status: "COMPLETED", createdAt: { gte: since } },
    },
    _sum: { quantity: true },
  });
  const soldIds = new Set(sold.filter((row) => row.productId).map((row) => row.productId!));
  const critical = products.filter((product) => product.stock <= product.minStock);
  const runningOut = products.filter(
    (product) => product.stock > product.minStock && product.stock <= product.minStock * 2,
  );
  const slowMoving = products.filter((product) => product.stock > 0 && !soldIds.has(product.id));
  return {
    critical,
    runningOut,
    slowMoving,
    pendingSuggestions,
    alerts: [
      ...(critical.length ? [`${critical.length} productos en stock crítico`] : []),
      ...(runningOut.length ? [`${runningOut.length} productos próximos a agotarse`] : []),
      ...(slowMoving.length ? [`${slowMoving.length} productos sin ventas en 30 días`] : []),
    ],
  };
}
