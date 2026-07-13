import { db } from "@/lib/db";
import { roundMoney } from "@/lib/retail/money";
import { prepareOrderDispatch } from "../dispatch/dispatch.service";
import { recordDecisionFeedback } from "./learning.service";

export async function updateSuggestedOrderItems(
  storeId: string,
  orderId: string,
  items: Array<{ itemId?: string; productId: string; quantity: number; unitCost?: number }>,
  notes?: string | null,
) {
  const order = await db.retailPurchaseOrder.findFirst({
    where: { id: orderId, storeId, status: { in: ["SUGGESTED", "DRAFT"] } },
    include: { items: true },
  });
  if (!order) throw new Error("El pedido no se puede editar");
  if (!items.length) throw new Error("El pedido debe tener al menos un producto");

  const productIds = [...new Set(items.map((i) => i.productId))];
  const products = await db.retailProduct.findMany({
    where: { id: { in: productIds }, storeId, deletedAt: null },
  });
  if (products.length !== productIds.length) throw new Error("Producto no válido");
  const byId = new Map(products.map((p) => [p.id, p]));

  const profiles = await db.retailProductIntelProfile.findMany({
    where: { storeId, productId: { in: [...new Set([
      ...order.items.map((i) => i.productId).filter(Boolean) as string[],
      ...productIds,
    ])] } },
  });
  const suggestedByProduct = new Map(
    profiles.map((p) => [p.productId, p.suggestedReorderQty]),
  );
  const beforeByProduct = new Map(
    order.items
      .filter((i) => i.productId)
      .map((i) => [i.productId!, i.quantity]),
  );

  const updated = await db.$transaction(async (tx) => {
    await tx.retailPurchaseOrderItem.deleteMany({ where: { purchaseOrderId: orderId } });
    const created = items.map((item) => {
      const product = byId.get(item.productId)!;
      const unitCost = roundMoney(item.unitCost ?? Number(product.cost));
      const quantity = Math.max(1, Math.trunc(item.quantity));
      return {
        productId: product.id,
        productName: product.name,
        quantity,
        unitCost,
        lineTotal: roundMoney(unitCost * quantity),
      };
    });
    await tx.retailPurchaseOrderItem.createMany({
      data: created.map((row) => ({ ...row, purchaseOrderId: orderId })),
    });
    return tx.retailPurchaseOrder.update({
      where: { id: orderId },
      data: {
        status: "DRAFT",
        notes: notes === undefined ? order.notes : notes?.trim() || null,
        totalCost: roundMoney(created.reduce((s, r) => s + r.lineTotal, 0)),
      },
      include: { items: true, supplier: true },
    });
  });

  const afterIds = new Set(items.map((i) => i.productId));
  const feedback = [];

  for (const [productId, beforeQty] of beforeByProduct) {
    if (!afterIds.has(productId)) {
      feedback.push({
        storeId,
        orderId,
        productId,
        action: "PRODUCT_REMOVED" as const,
        suggestedQty: suggestedByProduct.get(productId) ?? beforeQty,
        approvedQty: 0,
      });
    }
  }

  for (const item of items) {
    const before = beforeByProduct.get(item.productId);
    const suggested = suggestedByProduct.get(item.productId) ?? before ?? item.quantity;
    if (before == null) {
      feedback.push({
        storeId,
        orderId,
        productId: item.productId,
        action: "PRODUCT_ADDED" as const,
        suggestedQty: suggested,
        approvedQty: item.quantity,
      });
    } else if (before !== item.quantity) {
      feedback.push({
        storeId,
        orderId,
        productId: item.productId,
        action: "QTY_ADJUSTED" as const,
        suggestedQty: suggested,
        approvedQty: item.quantity,
      });
    }
  }

  if (notes !== undefined && (notes?.trim() || "") !== (order.notes ?? "")) {
    feedback.push({
      storeId,
      orderId,
      action: "NOTES_UPDATED" as const,
      note: notes,
    });
  }

  await recordDecisionFeedback(feedback);
  return updated;
}

export async function changeOrderSupplier(
  storeId: string,
  orderId: string,
  supplierId: string | null,
) {
  const order = await db.retailPurchaseOrder.findFirst({
    where: { id: orderId, storeId, status: { in: ["SUGGESTED", "DRAFT"] } },
  });
  if (!order) throw new Error("El pedido no se puede editar");
  if (supplierId) {
    const supplier = await db.retailSupplier.findFirst({
      where: { id: supplierId, storeId, deletedAt: null },
    });
    if (!supplier) throw new Error("Proveedor no encontrado");
  }
  const updated = await db.retailPurchaseOrder.update({
    where: { id: orderId },
    data: {
      supplierId,
      status: order.status === "SUGGESTED" ? "DRAFT" : order.status,
    },
    include: { items: true, supplier: true },
  });
  await recordDecisionFeedback([
    {
      storeId,
      orderId,
      action: "SUPPLIER_CHANGED",
      note: JSON.stringify({ from: order.supplierId, to: supplierId }),
    },
  ]);
  return updated;
}

export async function updateOrderNotes(storeId: string, orderId: string, notes: string) {
  const order = await db.retailPurchaseOrder.findFirst({
    where: { id: orderId, storeId, status: { in: ["SUGGESTED", "DRAFT", "APPROVED"] } },
  });
  if (!order) throw new Error("Pedido no encontrado");
  const updated = await db.retailPurchaseOrder.update({
    where: { id: orderId },
    data: {
      notes: notes.trim() || null,
      status: order.status === "SUGGESTED" ? "DRAFT" : order.status,
    },
  });
  await recordDecisionFeedback([
    {
      storeId,
      orderId,
      action: "NOTES_UPDATED",
      note: notes,
    },
  ]);
  return updated;
}

export async function approveIntelOrder(storeId: string, orderId: string, userId?: string) {
  const order = await db.retailPurchaseOrder.findFirst({
    where: { id: orderId, storeId, status: { in: ["SUGGESTED", "DRAFT"] } },
    include: { items: true },
  });
  if (!order) throw new Error("El pedido no se puede aprobar");

  const productIds = order.items.map((i) => i.productId).filter(Boolean) as string[];
  const profiles = productIds.length
    ? await db.retailProductIntelProfile.findMany({
        where: { storeId, productId: { in: productIds } },
      })
    : [];
  const suggestedByProduct = new Map(
    profiles.map((p) => [p.productId, p.suggestedReorderQty]),
  );

  const updated = await db.retailPurchaseOrder.update({
    where: { id: orderId },
    data: {
      status: "APPROVED",
      createdByUserId: userId ?? order.createdByUserId,
    },
    include: { items: true, supplier: true },
  });

  if (productIds.length) {
    await db.retailPurchaseSuggestion.updateMany({
      where: { storeId, productId: { in: productIds }, status: "PENDING" },
      data: { status: "APPROVED", resolvedAt: new Date() },
    });
  }

  await recordDecisionFeedback(
    order.items
      .filter((item) => item.productId)
      .map((item) => ({
        storeId,
        orderId,
        productId: item.productId!,
        action: "APPROVE_ORDER" as const,
        suggestedQty: suggestedByProduct.get(item.productId!) ?? item.quantity,
        approvedQty: item.quantity,
      })),
  );

  return updated;
}

export async function sendIntelOrder(storeId: string, orderId: string, userId?: string) {
  const order = await db.retailPurchaseOrder.findFirst({
    where: { id: orderId, storeId },
  });
  if (!order) throw new Error("Pedido no encontrado");
  if (order.status === "SUGGESTED" || order.status === "DRAFT") {
    await approveIntelOrder(storeId, orderId, userId);
  }
  return prepareOrderDispatch(storeId, orderId);
}

export async function dismissIntelOrder(storeId: string, orderId: string) {
  const order = await db.retailPurchaseOrder.findFirst({
    where: {
      id: orderId,
      storeId,
      status: { in: ["SUGGESTED", "DRAFT"] },
      aiGenerated: true,
    },
    include: { items: true },
  });
  if (!order) throw new Error("Pedido sugerido no encontrado");

  const productIds = order.items.map((i) => i.productId).filter(Boolean) as string[];
  await db.$transaction(async (tx) => {
    await tx.retailPurchaseOrder.update({
      where: { id: orderId },
      data: { status: "CANCELLED" },
    });
    if (productIds.length) {
      await tx.retailPurchaseSuggestion.updateMany({
        where: { storeId, productId: { in: productIds }, status: "PENDING" },
        data: { status: "DISMISSED", resolvedAt: new Date() },
      });
    }
  });

  await recordDecisionFeedback(
    productIds.length
      ? productIds.map((productId) => ({
          storeId,
          orderId,
          productId,
          action: "DISMISS_ORDER" as const,
          suggestedQty: order.items.find((i) => i.productId === productId)?.quantity ?? null,
          approvedQty: 0,
        }))
      : [{ storeId, orderId, action: "DISMISS_ORDER" as const, approvedQty: 0 }],
  );
}
