import { db } from "@/lib/db";
import { roundMoney } from "../lib/money";
import type { CustomerInput, CustomerPaymentInput } from "../types";

export function listCustomers(storeId: string) {
  return db.retailCustomer.findMany({
    where: { storeId, deletedAt: null },
    orderBy: { name: "asc" },
  });
}

export function createCustomer(storeId: string, input: CustomerInput) {
  if (!input.name.trim()) throw new Error("El nombre es obligatorio");
  return db.retailCustomer.create({
    data: { ...input, storeId, name: input.name.trim(), creditLimit: input.creditLimit ?? 0 },
  });
}

export async function updateCustomer(storeId: string, id: string, input: Partial<CustomerInput>) {
  const customer = await db.retailCustomer.findFirst({
    where: { id, storeId, deletedAt: null },
  });
  if (!customer) throw new Error("Cliente no encontrado");
  return db.retailCustomer.update({
    where: { id },
    data: { ...input, name: input.name?.trim() },
  });
}

export async function softDeleteCustomer(storeId: string, id: string) {
  const customer = await db.retailCustomer.findFirst({
    where: { id, storeId, deletedAt: null },
  });
  if (!customer) throw new Error("Cliente no encontrado");
  if (Number(customer.creditBalance) > 0) {
    throw new Error("No se puede eliminar un cliente con saldo pendiente");
  }
  return db.retailCustomer.update({
    where: { id },
    data: { deletedAt: new Date(), status: "INACTIVE" },
  });
}

export function listDebtors(storeId: string) {
  return db.retailCustomer.findMany({
    where: { storeId, deletedAt: null, status: "ACTIVE", creditBalance: { gt: 0 } },
    orderBy: { creditBalance: "desc" },
  });
}

export async function recordPayment(
  storeId: string,
  input: CustomerPaymentInput,
  userId?: string,
) {
  const amount = roundMoney(input.amount);
  if (amount <= 0) throw new Error("El abono debe ser mayor que cero");

  return db.$transaction(async (tx) => {
    const customer = await tx.retailCustomer.findFirst({
      where: { id: input.customerId, storeId, deletedAt: null },
    });
    if (!customer) throw new Error("Cliente no encontrado");
    if (amount > Number(customer.creditBalance)) {
      throw new Error("El abono supera el saldo pendiente");
    }
    const payment = await tx.retailCustomerPayment.create({
      data: {
        storeId,
        customerId: customer.id,
        amount,
        method: input.method ?? "CASH",
        note: input.note,
        createdByUserId: userId,
      },
    });
    await tx.retailCustomer.update({
      where: { id: customer.id },
      data: { creditBalance: { decrement: amount } },
    });
    return payment;
  });
}

export {
  listCustomers as list,
  createCustomer as create,
  updateCustomer as update,
  softDeleteCustomer as softDelete,
};
