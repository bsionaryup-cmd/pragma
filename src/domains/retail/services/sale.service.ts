import { db } from "@/lib/db";
import { generateSaleCode } from "../lib/codes";
import { roundMoney } from "../lib/money";
import type { SaleInput } from "../types";
import {
  enqueueSaleCancelled,
  enqueueSaleCompleted,
} from "@/domains/retail-intelligence/services/outbox.publisher";

function validateItems(input: SaleInput) {
  if (!input.items.length) throw new Error("La venta debe incluir productos");
  if (input.items.some((item) => !Number.isInteger(item.quantity) || item.quantity <= 0)) {
    throw new Error("Las cantidades deben ser enteros positivos");
  }
}

async function createSaleWithStatus(
  storeId: string,
  input: SaleInput,
  status: "COMPLETED" | "SUSPENDED",
  userId?: string,
) {
  validateItems(input);
  return db.$transaction(async (tx) => {
    const ids = [...new Set(input.items.map((item) => item.productId))];
    const products = await tx.retailProduct.findMany({
      where: { id: { in: ids }, storeId, deletedAt: null, status: "ACTIVE" },
    });
    if (products.length !== ids.length) throw new Error("Uno o más productos no existen");
    const byId = new Map(products.map((product) => [product.id, product]));

    if (input.cashSessionId) {
      const session = await tx.retailCashSession.findFirst({
        where: { id: input.cashSessionId, storeId, status: "OPEN" },
      });
      if (!session) throw new Error("La sesión de caja no está abierta");
    } else if (status === "COMPLETED") {
      throw new Error("Debes abrir caja antes de registrar ventas.");
    }

    const paymentMethod = input.paymentMethod ?? "CASH";
    if (paymentMethod === "CREDIT" && !input.customerId) {
      throw new Error("Una venta a crédito requiere cliente");
    }
    const customer = input.customerId
      ? await tx.retailCustomer.findFirst({
          where: { id: input.customerId, storeId, deletedAt: null, status: "ACTIVE" },
        })
      : null;
    if (input.customerId && !customer) throw new Error("Cliente no encontrado");

    const items = input.items.map((item) => {
      const product = byId.get(item.productId)!;
      const unitPrice = roundMoney(item.unitPrice ?? product.price);
      return {
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        unitPrice,
        unitCost: product.cost,
        lineTotal: roundMoney(unitPrice * item.quantity),
      };
    });
    const subtotal = roundMoney(items.reduce((sum, item) => sum + item.lineTotal, 0));
    const discount = roundMoney(input.discount ?? 0);
    if (discount < 0 || discount > subtotal) throw new Error("Descuento inválido");
    const deliveryFee = roundMoney(input.deliveryFee ?? 0);
    if (deliveryFee < 0) throw new Error("Domicilio inválido");
    const total = roundMoney(subtotal - discount + deliveryFee);
    const amountPaid =
      paymentMethod === "CREDIT" ? 0 : roundMoney(input.amountPaid ?? total);
    if (status === "COMPLETED" && paymentMethod !== "CREDIT" && amountPaid < total) {
      throw new Error("El monto pagado es insuficiente");
    }
    if (
      status === "COMPLETED" &&
      customer &&
      paymentMethod === "CREDIT" &&
      Number(customer.creditLimit) > 0 &&
      Number(customer.creditBalance) + total > Number(customer.creditLimit)
    ) {
      throw new Error("La venta supera el cupo de crédito");
    }

    const sale = await tx.retailSale.create({
      data: {
        storeId,
        cashSessionId: input.cashSessionId,
        customerId: input.customerId,
        code: generateSaleCode(),
        status,
        paymentMethod,
        subtotal,
        discount,
        total,
        amountPaid,
        changeGiven: paymentMethod === "CREDIT" ? 0 : roundMoney(amountPaid - total),
        isCredit: paymentMethod === "CREDIT",
        soldByUserId: userId,
        note: input.note,
        items: { create: items },
      },
      include: { items: true },
    });

    if (status === "COMPLETED") {
      for (const item of items) {
        const changed = await tx.retailProduct.updateMany({
          where: {
            id: item.productId,
            storeId,
            deletedAt: null,
            stock: { gte: item.quantity },
          },
          data: { stock: { decrement: item.quantity } },
        });
        if (changed.count !== 1) throw new Error(`Stock insuficiente para ${item.productName}`);
        const product = await tx.retailProduct.findUniqueOrThrow({
          where: { id: item.productId },
        });
        await tx.retailInventoryMovement.create({
          data: {
            storeId,
            productId: item.productId,
            type: "SALE",
            quantity: -item.quantity,
            balanceAfter: product.stock,
            unitCost: item.unitCost,
            referenceId: sale.id,
            createdByUserId: userId,
          },
        });
      }
      if (customer && paymentMethod === "CREDIT") {
        await tx.retailCustomer.update({
          where: { id: customer.id },
          data: { creditBalance: { increment: total } },
        });
      }
      await enqueueSaleCompleted(
        tx,
        storeId,
        sale.id,
        items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          unitCost: Number(item.unitCost),
        })),
      );
    }
    return sale;
  });
}

export function createSale(storeId: string, input: SaleInput, userId?: string) {
  return createSaleWithStatus(storeId, input, "COMPLETED", userId);
}

export function suspendSale(storeId: string, input: SaleInput, userId?: string) {
  return createSaleWithStatus(storeId, input, "SUSPENDED", userId);
}

export async function cancelSale(storeId: string, saleId: string, userId?: string) {
  return db.$transaction(async (tx) => {
    const sale = await tx.retailSale.findFirst({
      where: { id: saleId, storeId },
      include: { items: true },
    });
    if (!sale || sale.status === "CANCELLED") throw new Error("Venta no encontrada");
    if (sale.status === "COMPLETED") {
      for (const item of sale.items) {
        if (!item.productId) continue;
        const product = await tx.retailProduct.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
        await tx.retailInventoryMovement.create({
          data: {
            storeId,
            productId: item.productId,
            type: "RETURN",
            quantity: item.quantity,
            balanceAfter: product.stock,
            unitCost: item.unitCost,
            referenceId: sale.id,
            note: "Anulación de venta",
            createdByUserId: userId,
          },
        });
      }
      if (sale.isCredit && sale.customerId) {
        const customer = await tx.retailCustomer.findUnique({ where: { id: sale.customerId } });
        if (customer) {
          const decrement = Math.min(Number(customer.creditBalance), Number(sale.total));
          await tx.retailCustomer.update({
            where: { id: customer.id },
            data: { creditBalance: { decrement } },
          });
        }
      }
      await enqueueSaleCancelled(
        tx,
        storeId,
        sale.id,
        sale.items.map((i) => i.productId).filter(Boolean) as string[],
      );
    }
    return tx.retailSale.update({
      where: { id: sale.id },
      data: { status: "CANCELLED" },
    });
  });
}

export function listSales(storeId: string, from?: Date, to?: Date) {
  return db.retailSale.findMany({
    where: { storeId, createdAt: { gte: from, lte: to } },
    include: { customer: true, items: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getSale(storeId: string, id: string) {
  const sale = await db.retailSale.findFirst({
    where: { id, storeId },
    include: { customer: true, items: true, cashSession: { include: { register: true } } },
  });
  if (!sale) throw new Error("Venta no encontrada");
  return sale;
}

export function listSuspended(storeId: string) {
  return db.retailSale.findMany({
    where: { storeId, status: "SUSPENDED" },
    include: { customer: true, items: true },
    orderBy: { createdAt: "desc" },
  });
}
