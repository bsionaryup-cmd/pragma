/**
 * Legacy compatibility facade.
 * Inventory Intelligence lives in `@/domains/retail-intelligence`.
 */
import { db } from "@/lib/db";
import {
  approveIntelOrder,
  bootstrapStoreIntelligence,
  dismissIntelOrder,
} from "@/domains/retail-intelligence";

export { getAiDashboardInsights } from "./ai-engine.legacy-helpers";

export async function analyzeAndSuggestPurchases(storeId: string) {
  await bootstrapStoreIntelligence(storeId);
  return db.retailPurchaseSuggestion.findMany({
    where: { storeId, status: "PENDING" },
    include: { product: true },
  });
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
      id: { in: suggestions.flatMap((item) => (item.supplierId ? [item.supplierId] : [])) },
    },
  });
  const names = new Map(suppliers.map((supplier) => [supplier.id, supplier.name]));
  return Object.values(
    suggestions.reduce<
      Record<
        string,
        {
          supplierId: string | null;
          supplierName: string;
          suggestions: typeof suggestions;
        }
      >
    >((groups, suggestion) => {
      const key = suggestion.supplierId ?? "unassigned";
      groups[key] ??= {
        supplierId: suggestion.supplierId,
        supplierName: suggestion.supplierId
          ? (names.get(suggestion.supplierId) ?? "Proveedor no disponible")
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
  const suggestion = await db.retailPurchaseSuggestion.findFirst({
    where: { id: suggestionId, storeId, status: "PENDING" },
  });
  if (!suggestion) throw new Error("Sugerencia no encontrada");
  const order = await db.retailPurchaseOrder.findFirst({
    where: {
      storeId,
      status: "SUGGESTED",
      aiGenerated: true,
      ...(suggestion.supplierId
        ? { supplierId: suggestion.supplierId }
        : { supplierId: null }),
    },
    orderBy: { createdAt: "desc" },
  });
  if (order) return approveIntelOrder(storeId, order.id, userId);
  await bootstrapStoreIntelligence(storeId);
  const regenerated = await db.retailPurchaseOrder.findFirst({
    where: {
      storeId,
      status: "SUGGESTED",
      aiGenerated: true,
      supplierId: suggestion.supplierId,
    },
  });
  if (!regenerated) throw new Error("No hay pedido sugerido para aprobar");
  return approveIntelOrder(storeId, regenerated.id, userId);
}

export async function dismissSuggestion(storeId: string, suggestionId: string) {
  const suggestion = await db.retailPurchaseSuggestion.findFirst({
    where: { id: suggestionId, storeId, status: "PENDING" },
  });
  if (!suggestion) throw new Error("Sugerencia no encontrada");
  const order = await db.retailPurchaseOrder.findFirst({
    where: {
      storeId,
      status: "SUGGESTED",
      aiGenerated: true,
      supplierId: suggestion.supplierId,
    },
  });
  if (order) {
    await dismissIntelOrder(storeId, order.id);
    return suggestion;
  }
  return db.retailPurchaseSuggestion.update({
    where: { id: suggestion.id },
    data: { status: "DISMISSED", resolvedAt: new Date() },
  });
}
