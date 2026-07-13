import { db } from "@/lib/db";
import { generatePurchaseCode } from "../lib/codes";
import { roundMoney } from "../lib/money";
import type { PurchaseOrderInput, ReceivePurchaseItemInput } from "../types";
import { enqueuePurchaseReceived } from "@/domains/retail-intelligence/services/outbox.publisher";

export function listOrders(storeId: string) {
  return db.retailPurchaseOrder.findMany({
    where: { storeId },
    include: { supplier: true, items: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getOrder(storeId: string, id: string) {
  const order = await db.retailPurchaseOrder.findFirst({
    where: { id, storeId },
    include: { supplier: true, items: { include: { product: true } } },
  });
  if (!order) throw new Error("Pedido de compra no encontrado");
  return order;
}

export async function createDraftOrder(
  storeId: string,
  input: PurchaseOrderInput,
  userId?: string,
) {
  if (!input.items.length) throw new Error("La orden debe incluir productos");
  if (input.items.some((item) => !Number.isInteger(item.quantity) || item.quantity <= 0)) {
    throw new Error("Las cantidades deben ser enteros positivos");
  }
  const ids = [...new Set(input.items.map((item) => item.productId))];
  const products = await db.retailProduct.findMany({
    where: { id: { in: ids }, storeId, deletedAt: null },
  });
  if (products.length !== ids.length) throw new Error("Uno o más productos no existen");
  if (input.supplierId) {
    const supplier = await db.retailSupplier.findFirst({
      where: { id: input.supplierId, storeId, deletedAt: null },
    });
    if (!supplier) throw new Error("Proveedor no encontrado");
  }
  const byId = new Map(products.map((product) => [product.id, product]));
  const items = input.items.map((item) => {
    const product = byId.get(item.productId)!;
    const unitCost = roundMoney(item.unitCost ?? product.cost);
    return {
      productId: product.id,
      productName: product.name,
      quantity: item.quantity,
      unitCost,
      lineTotal: roundMoney(unitCost * item.quantity),
    };
  });
  return db.retailPurchaseOrder.create({
    data: {
      storeId,
      supplierId: input.supplierId,
      code: generatePurchaseCode(),
      totalCost: roundMoney(items.reduce((sum, item) => sum + item.lineTotal, 0)),
      aiGenerated: input.aiGenerated ?? false,
      notes: input.notes,
      createdByUserId: userId,
      items: { create: items },
    },
    include: { items: true, supplier: true },
  });
}

export async function approveOrder(storeId: string, id: string) {
  const order = await db.retailPurchaseOrder.findFirst({
    where: { id, storeId, status: { in: ["DRAFT", "SUGGESTED"] } },
  });
  if (!order) throw new Error("El pedido no se puede aprobar");
  return db.retailPurchaseOrder.update({
    where: { id },
    data: { status: "APPROVED" },
  });
}

export async function receiveOrder(
  storeId: string,
  id: string,
  receivedItems?: ReceivePurchaseItemInput[],
  userId?: string,
) {
  return db.$transaction(async (tx) => {
    const order = await tx.retailPurchaseOrder.findFirst({
      where: { id, storeId, status: { in: ["APPROVED", "SENT"] } },
      include: { items: true },
    });
    if (!order) throw new Error("El pedido no está disponible para recepción");
    const quantities = new Map(receivedItems?.map((item) => [item.itemId, item.receivedQuantity]));

    for (const item of order.items) {
      const quantity = quantities.size ? quantities.get(item.id) ?? 0 : item.quantity;
      if (!Number.isInteger(quantity) || quantity < 0 || quantity > item.quantity) {
        throw new Error(`Cantidad recibida inválida para ${item.productName}`);
      }
      if (!item.productId || quantity === 0) {
        await tx.retailPurchaseOrderItem.update({
          where: { id: item.id },
          data: { receivedQuantity: quantity },
        });
        continue;
      }
      const product = await tx.retailProduct.findFirst({
        where: { id: item.productId, storeId, deletedAt: null },
      });
      if (!product) throw new Error(`Producto no disponible: ${item.productName}`);
      const updated = await tx.retailProduct.update({
        where: { id: product.id },
        data: { stock: { increment: quantity }, cost: item.unitCost },
      });
      await tx.retailPurchaseOrderItem.update({
        where: { id: item.id },
        data: { receivedQuantity: quantity },
      });
      await tx.retailInventoryMovement.create({
        data: {
          storeId,
          productId: product.id,
          type: "PURCHASE",
          quantity,
          balanceAfter: updated.stock,
          unitCost: item.unitCost,
          referenceId: order.id,
          createdByUserId: userId,
        },
      });
    }
    if (order.supplierId) {
      await tx.retailSupplier.update({
        where: { id: order.supplierId },
        data: { lastPurchaseAt: new Date() },
      });
    }
    const productIds = order.items
      .map((item) => item.productId)
      .filter(Boolean) as string[];
    await enqueuePurchaseReceived(tx, storeId, order.id, order.supplierId, productIds);
    return tx.retailPurchaseOrder.update({
      where: { id: order.id },
      data: { status: "RECEIVED", receivedAt: new Date() },
      include: { items: true, supplier: true },
    });
  });
}

export async function cancelOrder(storeId: string, id: string) {
  const order = await db.retailPurchaseOrder.findFirst({
    where: { id, storeId, status: { notIn: ["RECEIVED", "CANCELLED"] } },
  });
  if (!order) throw new Error("El pedido no se puede cancelar");
  return db.retailPurchaseOrder.update({
    where: { id },
    data: { status: "CANCELLED" },
  });
}
