import { db } from "@/lib/db";
import { ensureStoreIntelligence } from "./worker.service";
import {
  buildMailtoUrl,
  buildPedidoMessage,
  buildWhatsAppUrl,
} from "../dispatch/message";
import {
  buildSupplyBriefing,
  explainRecommendation,
  mapVisualPriority,
  visualPriorityLabel,
  type VisualPriority,
} from "../lib/briefing";

function money(value: unknown) {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "object" && value !== null && "toNumber" in value) {
    return (value as { toNumber(): number }).toNumber();
  }
  return Number(value);
}

export async function getPedidosDashboard(storeId: string) {
  await ensureStoreIntelligence(storeId);

  const [profiles, suggestedOrders, suppliers, products, cashSession] = await Promise.all([
    db.retailProductIntelProfile.findMany({
      where: { storeId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            stock: true,
            minStock: true,
            idealStock: true,
          },
        },
      },
      orderBy: [{ priority: "asc" }, { estimatedStockoutDate: "asc" }],
    }),
    db.retailPurchaseOrder.findMany({
      where: {
        storeId,
        aiGenerated: true,
        status: { in: ["SUGGESTED", "DRAFT"] },
      },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            whatsapp: true,
            leadTimeDays: true,
            usualDeliveryDows: true,
            notes: true,
            preferredDispatchChannel: true,
            status: true,
          },
        },
        items: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    db.retailSupplier.findMany({
      where: { storeId, deletedAt: null, status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        leadTimeDays: true,
        whatsapp: true,
        phone: true,
        email: true,
      },
    }),
    db.retailProduct.findMany({
      where: { storeId, deletedAt: null, status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, cost: true, stock: true },
    }),
    db.retailCashSession.findFirst({
      where: { storeId, status: "OPEN" },
      select: { id: true },
    }),
  ]);

  const profileByProduct = new Map(profiles.map((p) => [p.productId, p]));
  const cashOpen = Boolean(cashSession);

  const ordersBySupplier = suggestedOrders.map((order) => {
    const supplierName = order.supplier?.name ?? "Sin proveedor";
    const contact = order.supplier?.whatsapp || order.supplier?.phone || null;
    const leadTimeDays = order.supplier?.leadTimeDays ?? 3;
    const lines = order.items.map((item) => ({
      productName: item.productName,
      quantity: item.quantity,
    }));
    const message = buildPedidoMessage({
      supplierName,
      lines,
      orderCode: order.code,
      notes: order.notes,
    });

    const enrichedItems = order.items.map((item) => {
      const profile = item.productId ? profileByProduct.get(item.productId) : null;
      const avg7 = profile ? money(profile.avgDailySales7) : 0;
      const stock = profile?.product.stock ?? 0;
      const suggestedQty = profile?.suggestedReorderQty ?? item.quantity;
      const daysOfCover = profile?.daysOfCover != null ? money(profile.daysOfCover) : null;
      const action = profile?.suggestedAction ?? "BUY_SOON";
      const explanation = explainRecommendation({
        action,
        stock,
        suggestedQty,
        avgDailySales7: avg7,
        leadTimeDays,
        daysOfCover,
        supplierPickReason: profile?.xyzClass ?? null,
      });
      return {
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitCost: money(item.unitCost),
        lineTotal: money(item.lineTotal),
        stock,
        suggestedQty,
        daysOfCover,
        estimatedStockoutDate: profile?.estimatedStockoutDate ?? null,
        action,
        decision: explanation.decision,
        motivo: explanation.motivo,
        details: explanation.details,
      };
    });

    const coverages = enrichedItems
      .map((i) => i.daysOfCover)
      .filter((v): v is number => v != null);
    const minCover = coverages.length ? Math.min(...coverages) : null;
    const worstPriority =
      enrichedItems
        .map((item) => {
          const p = item.productId ? profileByProduct.get(item.productId) : null;
          return p?.priority ?? "LOW";
        })
        .sort((a, b) => {
          const rank = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 } as const;
          return rank[a as keyof typeof rank] - rank[b as keyof typeof rank];
        })[0] ?? "LOW";

    const visualPriority: VisualPriority = mapVisualPriority({
      priority: worstPriority,
      daysOfCover: minCover,
      leadTimeDays,
    });

    const recommendedAction =
      visualPriority === "URGENT"
        ? "Aprobar y enviar hoy"
        : visualPriority === "SOON"
          ? "Revisar esta semana"
          : "Programar cuando convenga";

    return {
      id: order.id,
      code: order.code,
      status: order.status,
      statusLabel: order.status === "DRAFT" ? "Editado" : "Sugerido",
      notes: order.notes,
      totalCost: money(order.totalCost),
      productCount: order.items.length,
      visualPriority,
      visualPriorityLabel: visualPriorityLabel(visualPriority),
      recommendedAction,
      estimatedCoverageDays: minCover != null ? Math.round(minCover) : null,
      leadTimeDays,
      supplier: order.supplier
        ? {
            id: order.supplier.id,
            name: order.supplier.name,
            email: order.supplier.email,
            phone: order.supplier.phone,
            whatsapp: order.supplier.whatsapp,
            leadTimeDays: order.supplier.leadTimeDays,
            usualDeliveryDows: order.supplier.usualDeliveryDows,
          }
        : null,
      items: enrichedItems,
      message,
      whatsappUrl: contact ? buildWhatsAppUrl(contact, message) : null,
      mailtoUrl: order.supplier?.email
        ? buildMailtoUrl({
            email: order.supplier.email,
            supplierName,
            orderCode: order.code,
            body: message,
          })
        : null,
    };
  });

  // Sort: urgent first
  ordersBySupplier.sort((a, b) => {
    const rank = { URGENT: 0, SOON: 1, NORMAL: 2 } as const;
    return rank[a.visualPriority] - rank[b.visualPriority];
  });

  const urgentOrderCount = ordersBySupplier.filter((o) => o.visualPriority === "URGENT").length;
  const soonOrderCount = ordersBySupplier.filter((o) => o.visualPriority === "SOON").length;
  const runningOutProductCount = profiles.filter(
    (p) =>
      p.suggestedAction === "RUNNING_OUT" ||
      p.suggestedAction === "CRITICAL" ||
      p.suggestedAction === "BUY_NOW",
  ).length;

  const waitSupplierNames = profiles
    .filter((p) => p.suggestedAction === "WAIT" && p.supplierId)
    .map((p) => suppliers.find((s) => s.id === p.supplierId)?.name)
    .filter((n): n is string => Boolean(n));

  const briefing = buildSupplyBriefing({
    cashOpen,
    urgentOrderCount,
    soonOrderCount,
    waitSupplierNames: [...new Set(waitSupplierNames)],
    runningOutProductCount,
    topUrgentSupplierName:
      ordersBySupplier.find((o) => o.visualPriority === "URGENT")?.supplier?.name ??
      ordersBySupplier[0]?.supplier?.name ??
      null,
  });

  return {
    briefing,
    cashOpen,
    ordersBySupplier,
    suppliers,
    products: products.map((p) => ({ ...p, cost: money(p.cost) })),
  };
}
