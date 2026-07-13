import { db } from "@/lib/db";
import { generatePurchaseCode } from "../lib/codes";
import { roundMoney } from "../lib/money";

const LOOKBACK_DAYS = 14;

export async function analyzeAndSuggestPurchases(storeId: string) {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const [products, sales] = await Promise.all([
    db.retailProduct.findMany({
      where: { storeId, deletedAt: null, status: "ACTIVE" },
      include: {
        supplierProducts: { include: { supplier: true }, orderBy: { cost: "asc" } },
      },
    }),
    db.retailSaleItem.groupBy({
      by: ["productId"],
      where: {
        productId: { not: null },
        sale: { storeId, status: "COMPLETED", createdAt: { gte: since } },
      },
      _sum: { quantity: true },
    }),
  ]);
  const soldByProduct = new Map(
    sales.filter((row) => row.productId).map((row) => [row.productId!, row._sum.quantity ?? 0]),
  );
  const results = [];

  for (const product of products) {
    const averageDailySales = (soldByProduct.get(product.id) ?? 0) / LOOKBACK_DAYS;
    const daysOfStockRemaining =
      averageDailySales > 0 ? Math.floor(product.stock / averageDailySales) : null;
    const lowByVelocity =
      daysOfStockRemaining !== null && daysOfStockRemaining <= 7;
    if (product.stock > product.minStock && !lowByVelocity) continue;

    const supplierProduct = product.supplierProducts.find(
      (row) => row.supplier.deletedAt === null && row.supplier.status === "ACTIVE",
    );
    const supplierId = product.primarySupplierId ?? supplierProduct?.supplierId ?? null;
    const suggestedQty = Math.max(
      1,
      product.idealStock - product.stock,
      supplierProduct?.minPurchaseQty ?? 1,
    );
    const reason =
      product.stock <= 0 ? "OUT_OF_STOCK" :
      product.stock <= product.minStock ? "LOW_STOCK" :
      "HIGH_ROTATION";
    const existing = await db.retailPurchaseSuggestion.findFirst({
      where: { storeId, productId: product.id, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    });
    const data = {
      supplierId,
      suggestedQty,
      reason,
      daysOfStockRemaining,
      averageDailySales,
      estimatedCost: roundMoney(
        suggestedQty * Number(supplierProduct?.cost ?? product.cost),
      ),
    } as const;
    results.push(
      existing
        ? await db.retailPurchaseSuggestion.update({ where: { id: existing.id }, data })
        : await db.retailPurchaseSuggestion.create({
            data: { storeId, productId: product.id, ...data },
          }),
    );
  }
  return results;
}

export async function groupSuggestionsBySupplier(storeId: string) {
  const suggestions = await db.retailPurchaseSuggestion.findMany({
    where: { storeId, status: "PENDING" },
    include: { product: true },
    orderBy: { createdAt: "asc" },
  });
  const suppliers = await db.retailSupplier.findMany({
    where: {
      storeId,
      deletedAt: null,
      id: { in: suggestions.flatMap((item) => item.supplierId ? [item.supplierId] : []) },
    },
  });
  const names = new Map(suppliers.map((supplier) => [supplier.id, supplier.name]));
  return Object.values(
    suggestions.reduce<Record<string, {
      supplierId: string | null;
      supplierName: string;
      suggestions: typeof suggestions;
    }>>((groups, suggestion) => {
      const key = suggestion.supplierId ?? "unassigned";
      groups[key] ??= {
        supplierId: suggestion.supplierId,
        supplierName: suggestion.supplierId
          ? names.get(suggestion.supplierId) ?? "Proveedor no disponible"
          : "Sin proveedor",
        suggestions: [],
      };
      groups[key].suggestions.push(suggestion);
      return groups;
    }, {}),
  );
}

export async function approveSuggestion(
  storeId: string,
  suggestionId: string,
  userId?: string,
) {
  return db.$transaction(async (tx) => {
    const selected = await tx.retailPurchaseSuggestion.findFirst({
      where: { id: suggestionId, storeId, status: "PENDING" },
    });
    if (!selected) throw new Error("Sugerencia no encontrada");
    if (!selected.supplierId) throw new Error("Asigna un proveedor antes de aprobar");
    const suggestions = await tx.retailPurchaseSuggestion.findMany({
      where: { storeId, supplierId: selected.supplierId, status: "PENDING" },
      include: { product: true },
    });
    const items = suggestions.map((suggestion) => {
      const unitCost = Number(suggestion.product.cost);
      return {
        productId: suggestion.productId,
        productName: suggestion.product.name,
        quantity: suggestion.suggestedQty,
        unitCost,
        lineTotal: roundMoney(unitCost * suggestion.suggestedQty),
      };
    });
    const order = await tx.retailPurchaseOrder.create({
      data: {
        storeId,
        supplierId: selected.supplierId,
        code: generatePurchaseCode(),
        status: "APPROVED",
        aiGenerated: true,
        createdByUserId: userId,
        totalCost: roundMoney(items.reduce((sum, item) => sum + item.lineTotal, 0)),
        items: { create: items },
      },
      include: { items: true, supplier: true },
    });
    await tx.retailPurchaseSuggestion.updateMany({
      where: { id: { in: suggestions.map((suggestion) => suggestion.id) } },
      data: { status: "APPROVED", resolvedAt: new Date() },
    });
    return order;
  });
}

export async function dismissSuggestion(storeId: string, suggestionId: string) {
  const suggestion = await db.retailPurchaseSuggestion.findFirst({
    where: { id: suggestionId, storeId, status: "PENDING" },
  });
  if (!suggestion) throw new Error("Sugerencia no encontrada");
  return db.retailPurchaseSuggestion.update({
    where: { id: suggestion.id },
    data: { status: "DISMISSED", resolvedAt: new Date() },
  });
}

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
