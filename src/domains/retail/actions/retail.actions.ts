"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireOpenCashSession } from "@/domains/retail/auth/require-open-cash";
import { requireRetailContext } from "@/domains/retail/auth/require-retail-context";
import { approveSuggestion, dismissSuggestion } from "@/domains/retail/services/ai-engine.service";
import { createDraftOrder, receiveOrder, approveOrder } from "@/domains/retail/services/purchase.service";
import { createSale } from "@/domains/retail/services/sale.service";
import {
  createWarehouse,
  softDeleteWarehouse,
  transferStock,
  updateWarehouse,
} from "@/domains/retail/services/warehouse.service";
import type { SaleInput } from "@/domains/retail/types";

const text = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const number = (data: FormData, key: string) => Number(data.get(key) ?? 0);
const optional = (value: string) => value || null;
const refresh = () => revalidatePath("/intiendas", "layout");

export async function createCategoryAction(data: FormData) {
  const { store } = await requireRetailContext();
  const name = text(data, "name");
  if (!name) throw new Error("El nombre de la categoría es obligatorio.");
  await db.retailCategory.create({ data: { storeId: store.id, name } });
  refresh();
}

export async function createProductAction(data: FormData) {
  const { store } = await requireRetailContext();
  const name = text(data, "name");
  if (!name) throw new Error("El nombre del producto es obligatorio.");
  const stock = Math.max(0, Math.trunc(number(data, "stock")));
  await db.$transaction(async (tx) => {
    const product = await tx.retailProduct.create({
      data: {
        storeId: store.id,
        name,
        sku: optional(text(data, "sku")),
        barcode: optional(text(data, "barcode")),
        categoryId: optional(text(data, "categoryId")),
        primarySupplierId: optional(text(data, "primarySupplierId")),
        cost: Math.max(0, number(data, "cost")),
        price: Math.max(0, number(data, "price")),
        stock,
        minStock: Math.max(0, Math.trunc(number(data, "minStock"))),
        idealStock: Math.max(0, Math.trunc(number(data, "idealStock"))),
        imageUrl: optional(text(data, "imageUrl")),
        isFavorite: data.get("isFavorite") === "on",
      },
    });
    if (stock) {
      await tx.retailInventoryMovement.create({
        data: {
          storeId: store.id,
          productId: product.id,
          type: "INITIAL",
          quantity: stock,
          balanceAfter: stock,
          unitCost: product.cost,
        },
      });
    }
  });
  refresh();
}

export async function updateProductAction(data: FormData) {
  const { store } = await requireRetailContext();
  const id = text(data, "id");
  const name = text(data, "name");
  if (!id || !name) throw new Error("Producto e nombre son obligatorios.");
  await db.retailProduct.update({
    where: { id, storeId: store.id },
    data: {
      name,
      sku: optional(text(data, "sku")),
      barcode: optional(text(data, "barcode")),
      categoryId: optional(text(data, "categoryId")),
      primarySupplierId: optional(text(data, "primarySupplierId")),
      cost: Math.max(0, number(data, "cost")),
      price: Math.max(0, number(data, "price")),
      minStock: Math.max(0, Math.trunc(number(data, "minStock"))),
      idealStock: Math.max(0, Math.trunc(number(data, "idealStock"))),
      imageUrl: optional(text(data, "imageUrl")),
      isFavorite: data.get("isFavorite") === "on",
    },
  });
  refresh();
}

export async function deleteProductAction(data: FormData) {
  const { store } = await requireRetailContext();
  const id = text(data, "id");
  if (!id) throw new Error("Producto no válido.");
  await db.retailProduct.update({
    where: { id, storeId: store.id },
    data: { deletedAt: new Date(), status: "INACTIVE" },
  });
  refresh();
}

export async function adjustStockAction(data: FormData) {
  const context = await requireRetailContext();
  const productId = text(data, "productId");
  const quantity = Math.trunc(number(data, "quantity"));
  if (!productId || !quantity) throw new Error("Indica producto y cantidad.");
  await db.$transaction(async (tx) => {
    const current = await tx.retailProduct.findFirst({
      where: { id: productId, storeId: context.store.id, deletedAt: null },
    });
    if (!current) throw new Error("Producto no encontrado.");
    if (current.stock + quantity < 0) throw new Error("El stock no puede quedar negativo.");
    const product = await tx.retailProduct.update({
      where: { id: productId },
      data: { stock: { increment: quantity } },
    });
    await tx.retailInventoryMovement.create({
      data: {
        storeId: context.store.id,
        productId,
        type: text(data, "note") === "Devolución" ? "RETURN" : quantity < 0 ? "LOSS" : "ADJUSTMENT",
        quantity,
        balanceAfter: product.stock,
        note: optional(text(data, "note")),
        createdByUserId: context.userId,
      },
    });
  });
  refresh();
}

export async function createSupplierAction(data: FormData) {
  const { store } = await requireRetailContext();
  const name = text(data, "name");
  if (!name) throw new Error("El nombre del proveedor es obligatorio.");
  await db.retailSupplier.create({
    data: {
      storeId: store.id,
      name,
      contactName: optional(text(data, "contactName")),
      phone: optional(text(data, "phone")),
      email: optional(text(data, "email")),
      leadTimeDays: Math.max(0, Math.trunc(number(data, "leadTimeDays"))),
    },
  });
  refresh();
}

export async function updateSupplierAction(data: FormData) {
  const { store } = await requireRetailContext();
  const id = text(data, "id");
  const name = text(data, "name");
  if (!id || !name) throw new Error("Proveedor e nombre son obligatorios.");
  await db.retailSupplier.update({
    where: { id, storeId: store.id },
    data: {
      name,
      contactName: optional(text(data, "contactName")),
      phone: optional(text(data, "phone")),
      email: optional(text(data, "email")),
      leadTimeDays: Math.max(0, Math.trunc(number(data, "leadTimeDays"))),
    },
  });
  refresh();
}

export async function deleteSupplierAction(data: FormData) {
  const { store } = await requireRetailContext();
  const id = text(data, "id");
  if (!id) throw new Error("Proveedor no válido.");
  await db.retailSupplier.update({
    where: { id, storeId: store.id },
    data: { deletedAt: new Date(), status: "INACTIVE" },
  });
  refresh();
}

export async function createCustomerAction(data: FormData) {
  const { store } = await requireRetailContext();
  const name = text(data, "name");
  if (!name) throw new Error("El nombre del cliente es obligatorio.");
  await db.retailCustomer.create({
    data: {
      storeId: store.id,
      name,
      phone: optional(text(data, "phone")),
      documentId: optional(text(data, "documentId")),
      creditLimit: Math.max(0, number(data, "creditLimit")),
    },
  });
  refresh();
}

export async function updateCustomerAction(data: FormData) {
  const { store } = await requireRetailContext();
  const id = text(data, "id");
  const name = text(data, "name");
  if (!id || !name) throw new Error("Cliente e nombre son obligatorios.");
  await db.retailCustomer.update({
    where: { id, storeId: store.id },
    data: {
      name,
      phone: optional(text(data, "phone")),
      documentId: optional(text(data, "documentId")),
      creditLimit: Math.max(0, number(data, "creditLimit")),
    },
  });
  refresh();
}

export async function deleteCustomerAction(data: FormData) {
  const { store } = await requireRetailContext();
  const id = text(data, "id");
  if (!id) throw new Error("Cliente no válido.");
  await db.retailCustomer.update({
    where: { id, storeId: store.id },
    data: { deletedAt: new Date(), status: "INACTIVE" },
  });
  refresh();
}

export async function registerCustomerPaymentAction(data: FormData) {
  const context = await requireRetailContext();
  const customerId = text(data, "customerId");
  const amount = number(data, "amount");
  if (!customerId || amount <= 0) throw new Error("Indica un cliente y un monto válido.");
  await db.$transaction([
    db.retailCustomerPayment.create({
      data: {
        storeId: context.store.id,
        customerId,
        amount,
        method: "CASH",
        createdByUserId: context.userId,
      },
    }),
    db.retailCustomer.update({
      where: { id: customerId, storeId: context.store.id },
      data: { creditBalance: { decrement: amount } },
    }),
  ]);
  refresh();
}

export async function completeSaleAction(input: SaleInput) {
  const context = await requireOpenCashSession();
  const sale = await createSale(
    context.store.id,
    {
      ...input,
      cashSessionId: context.cashSession.id,
      deliveryFee: input.deliveryFee ?? 0,
    },
    context.userId,
  );
  refresh();
  return { id: sale.id, code: sale.code };
}

export async function createSimplePurchaseAction(data: FormData) {
  const context = await requireOpenCashSession();
  const concept = text(data, "concept") || "OTRO";
  const description = text(data, "description");
  const amount = Math.max(0, number(data, "amount"));
  const supplierId = optional(text(data, "supplierId"));
  const productId = optional(text(data, "productId"));
  const quantity = Math.max(1, Math.trunc(number(data, "quantity") || 1));
  if (!description) throw new Error("Describe la compra.");
  if (amount <= 0) throw new Error("Indica un monto válido.");

  if (productId) {
    const unitCost = amount / quantity;
    await createDraftOrder(
      context.store.id,
      {
        supplierId,
        notes: `${concept}: ${description}`,
        items: [{ productId, quantity, unitCost }],
      },
      context.userId,
    );
  } else {
    await db.retailPurchaseOrder.create({
      data: {
        storeId: context.store.id,
        supplierId,
        code: `C-${Date.now().toString(36).toUpperCase()}`,
        status: "RECEIVED",
        totalCost: amount,
        notes: `${concept}: ${description}`,
        createdByUserId: context.userId,
        receivedAt: new Date(),
        items: {
          create: [
            {
              productName: description,
              quantity: 1,
              unitCost: amount,
              lineTotal: amount,
              receivedQuantity: 1,
            },
          ],
        },
      },
    });
  }
  refresh();
}

export async function updatePurchaseStatusAction(data: FormData) {
  const context = await requireOpenCashSession();
  const id = text(data, "id");
  const intent = text(data, "intent");
  if (intent === "receive") {
    await receiveOrder(context.store.id, id, undefined, context.userId);
  } else if (intent === "approve") {
    await approveOrder(context.store.id, id);
  } else {
    throw new Error("Acción de compra no válida.");
  }
  refresh();
}

export async function resolveSuggestionAction(data: FormData) {
  const context = await requireOpenCashSession();
  const id = text(data, "id");
  const intent = text(data, "intent");
  if (intent === "approve") {
    try {
      await approveSuggestion(context.store.id, id, context.userId);
    } catch {
      // Sin proveedor: crea orden simple DRAFT/APPROVED desde la sugerencia
      const suggestion = await db.retailPurchaseSuggestion.findFirst({
        where: { id, storeId: context.store.id, status: "PENDING" },
        include: { product: true },
      });
      if (!suggestion) throw new Error("Sugerencia no encontrada.");
      await db.$transaction(async (tx) => {
        const unitCost = Number(suggestion.estimatedCost ?? suggestion.product.cost) /
          Math.max(1, suggestion.suggestedQty);
        await tx.retailPurchaseOrder.create({
          data: {
            storeId: context.store.id,
            supplierId: suggestion.supplierId,
            code: `C-${Date.now().toString(36).toUpperCase()}`,
            status: "APPROVED",
            aiGenerated: true,
            totalCost: Number(suggestion.estimatedCost ?? 0),
            createdByUserId: context.userId,
            items: {
              create: [
                {
                  productId: suggestion.productId,
                  productName: suggestion.product.name,
                  quantity: suggestion.suggestedQty,
                  unitCost,
                  lineTotal: Number(suggestion.estimatedCost ?? unitCost * suggestion.suggestedQty),
                },
              ],
            },
          },
        });
        await tx.retailPurchaseSuggestion.update({
          where: { id: suggestion.id },
          data: { status: "APPROVED", resolvedAt: new Date() },
        });
      });
    }
  } else {
    await dismissSuggestion(context.store.id, id);
  }
  refresh();
}

export async function updateStoreAction(data: FormData) {
  const { store } = await requireRetailContext();
  const name = text(data, "name");
  if (!name) throw new Error("El nombre de la tienda es obligatorio.");
  await db.retailStore.update({ where: { id: store.id }, data: { name } });
  refresh();
}

export async function openCashAction(data: FormData) {
  const context = await requireRetailContext();
  const existing = await db.retailCashSession.findFirst({
    where: { storeId: context.store.id, status: "OPEN" },
  });
  if (existing) throw new Error("Ya hay una caja abierta.");
  let registerId = text(data, "registerId");
  if (!registerId) {
    const register = await db.retailCashRegister.create({
      data: { storeId: context.store.id, name: "Caja principal" },
    });
    registerId = register.id;
  }
  await db.retailCashSession.create({
    data: {
      storeId: context.store.id,
      registerId,
      openingAmount: Math.max(0, number(data, "openingAmount")),
      openedByUserId: context.userId,
    },
  });
  refresh();
}

export async function closeCashAction(data: FormData) {
  const { store } = await requireRetailContext();
  await db.retailCashSession.update({
    where: { id: text(data, "sessionId"), storeId: store.id },
    data: {
      status: "CLOSED",
      closingAmount: number(data, "closingAmount"),
      closedAt: new Date(),
    },
  });
  refresh();
}

export async function createWarehouseAction(data: FormData) {
  const { store } = await requireRetailContext();
  await createWarehouse(store.id, text(data, "name"));
  refresh();
}

export async function updateWarehouseAction(data: FormData) {
  const { store } = await requireRetailContext();
  await updateWarehouse(store.id, text(data, "id"), text(data, "name"));
  refresh();
}

export async function deleteWarehouseAction(data: FormData) {
  const { store } = await requireRetailContext();
  await softDeleteWarehouse(store.id, text(data, "id"));
  refresh();
}

export async function transferStockAction(data: FormData) {
  const context = await requireRetailContext();
  await transferStock({
    storeId: context.store.id,
    productId: text(data, "productId"),
    fromWarehouseId: text(data, "fromWarehouseId"),
    toWarehouseId: text(data, "toWarehouseId"),
    quantity: number(data, "quantity"),
    userId: context.userId,
  });
  refresh();
}
