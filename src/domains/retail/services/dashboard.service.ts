import { db } from "@/lib/db";

export async function getDashboardStats(storeId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    sales,
    openCash,
    products,
    pendingOrdersCount,
    debtorsCount,
    pendingSuggestionsCount,
  ] = await Promise.all([
    db.retailSale.aggregate({
      where: { storeId, status: "COMPLETED", createdAt: { gte: today } },
      _sum: { total: true },
      _count: true,
    }),
    db.retailCashSession.findFirst({
      where: { storeId, status: "OPEN" },
      include: { register: true },
      orderBy: { openedAt: "desc" },
    }),
    db.retailProduct.findMany({
      where: { storeId, deletedAt: null, status: "ACTIVE" },
      select: { stock: true, minStock: true },
    }),
    db.retailPurchaseOrder.count({
      where: { storeId, status: { in: ["SUGGESTED", "DRAFT", "APPROVED", "SENT"] } },
    }),
    db.retailCustomer.count({
      where: { storeId, deletedAt: null, creditBalance: { gt: 0 } },
    }),
    db.retailPurchaseSuggestion.count({ where: { storeId, status: "PENDING" } }),
  ]);

  return {
    todaySalesTotal: Number(sales._sum.total ?? 0),
    todaySalesCount: sales._count,
    openCash,
    criticalProductsCount: products.filter((product) => product.stock <= product.minStock).length,
    pendingOrdersCount,
    debtorsCount,
    pendingSuggestionsCount,
  };
}
