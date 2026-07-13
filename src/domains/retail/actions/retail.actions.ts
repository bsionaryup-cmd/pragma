"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRetailContext } from "@/domains/retail/auth/require-retail-context";
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
  const stock = Math.trunc(number(data, "stock"));
  await db.$transaction(async (tx) => {
    const product = await tx.retailProduct.create({
      data: {
        storeId: store.id,
        name,
        sku: optional(text(data, "sku")),
        barcode: optional(text(data, "barcode")),
        categoryId: optional(text(data, "categoryId")),
        cost: number(data, "cost"),
        price: number(data, "price"),
        stock,
        minStock: Math.trunc(number(data, "minStock")),
        idealStock: Math.trunc(number(data, "idealStock")),
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

export async function adjustStockAction(data: FormData) {
  const context = await requireRetailContext();
  const productId = text(data, "productId");
  const quantity = Math.trunc(number(data, "quantity"));
  if (!productId || !quantity) throw new Error("Indica producto y cantidad.");
  await db.$transaction(async (tx) => {
    const product = await tx.retailProduct.update({
      where: { id: productId, storeId: context.store.id },
      data: { stock: { increment: quantity } },
    });
    await tx.retailInventoryMovement.create({
      data: {
        storeId: context.store.id,
        productId,
        type: quantity < 0 ? "LOSS" : "ADJUSTMENT",
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

export async function createCustomerAction(data: FormData) {
  const { store } = await requireRetailContext();
  const name = text(data, "name");
  if (!name) throw new Error("El nombre del cliente es obligatorio.");
  await db.retailCustomer.create({
    data: {
      storeId: store.id,
      name,
      alias: optional(text(data, "alias")),
      phone: optional(text(data, "phone")),
      documentId: optional(text(data, "documentId")),
      creditLimit: Math.max(0, number(data, "creditLimit")),
    },
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
  const context = await requireRetailContext();
  if (!input.items.length) throw new Error("Agrega al menos un producto.");
  const productIds = input.items.map((item) => item.productId);
  const products = await db.retailProduct.findMany({
    where: { id: { in: productIds }, storeId: context.store.id, status: "ACTIVE" },
  });
  if (products.length !== new Set(productIds).size) throw new Error("Hay productos no disponibles.");
  const byId = new Map(products.map((p) => [p.id, p]));
  const subtotal = input.items.reduce((sum, item) => {
    const product = byId.get(item.productId)!;
    return sum + Number(product.price) * item.quantity;
  }, 0);
  const discount = Number(input.discount ?? 0);
  const total = Math.max(0, subtotal - discount);
  const code = `V-${Date.now().toString(36).toUpperCase()}`;

  const sale = await db.$transaction(async (tx) => {
    const created = await tx.retailSale.create({
      data: {
        storeId: context.store.id,
        code,
        customerId: input.customerId || null,
        cashSessionId: input.cashSessionId || null,
        paymentMethod: input.paymentMethod ?? "CASH",
        subtotal,
        discount,
        total,
        amountPaid: Number(input.amountPaid ?? total),
        isCredit: input.paymentMethod === "CREDIT",
        soldByUserId: context.userId,
        items: {
          create: input.items.map((item) => {
            const product = byId.get(item.productId)!;
            return {
              productId: product.id,
              productName: product.name,
              quantity: item.quantity,
              unitPrice: product.price,
              unitCost: product.cost,
              lineTotal: Number(product.price) * item.quantity,
            };
          }),
        },
      },
    });
    for (const item of input.items) {
      const product = await tx.retailProduct.update({
        where: { id: item.productId, storeId: context.store.id },
        data: { stock: { decrement: item.quantity } },
      });
      await tx.retailInventoryMovement.create({
        data: {
          storeId: context.store.id,
          productId: item.productId,
          type: "SALE",
          quantity: -item.quantity,
          balanceAfter: product.stock,
          referenceId: created.id,
          createdByUserId: context.userId,
        },
      });
    }
    if (input.paymentMethod === "CREDIT" && input.customerId) {
      await tx.retailCustomer.update({
        where: { id: input.customerId, storeId: context.store.id },
        data: { creditBalance: { increment: total } },
      });
    }
    return created;
  });
  refresh();
  return { id: sale.id, code: sale.code };
}

export async function updatePurchaseStatusAction(data: FormData) {
  const { store } = await requireRetailContext();
  const id = text(data, "id");
  const intent = text(data, "intent");
  await db.retailPurchaseOrder.update({
    where: { id, storeId: store.id },
    data: intent === "receive" ? { status: "RECEIVED", receivedAt: new Date() } : { status: "APPROVED" },
  });
  refresh();
}

export async function resolveSuggestionAction(data: FormData) {
  const { store } = await requireRetailContext();
  await db.retailPurchaseSuggestion.update({
    where: { id: text(data, "id"), storeId: store.id },
    data: {
      status: text(data, "intent") === "approve" ? "APPROVED" : "DISMISSED",
      resolvedAt: new Date(),
    },
  });
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
      openingAmount: number(data, "openingAmount"),
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
