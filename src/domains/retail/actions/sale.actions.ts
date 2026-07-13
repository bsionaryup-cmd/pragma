"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireOpenCashSession } from "../auth/require-open-cash";
import { requireRetailContext } from "../auth/require-retail-context";
import { cancelSale, createSale, suspendSale } from "../services/sale.service";
import type { SaleInput } from "../types";

function refresh() {
  revalidatePath("/intiendas", "layout");
}

export async function createSaleAction(input: SaleInput) {
  const ctx = await requireOpenCashSession();
  const result = await createSale(
    ctx.store.id,
    { ...input, cashSessionId: ctx.cashSession.id },
    ctx.userId,
  );
  refresh();
  return result;
}

export async function suspendSaleAction(input: SaleInput) {
  const ctx = await requireOpenCashSession();
  const result = await suspendSale(
    ctx.store.id,
    { ...input, cashSessionId: ctx.cashSession.id },
    ctx.userId,
  );
  refresh();
  return result;
}

export async function cancelSaleAction(id: string) {
  const ctx = await requireRetailContext();
  const result = await cancelSale(ctx.store.id, id, ctx.userId);
  refresh();
  return result;
}

/** Toma una venta en espera: la cancela y devuelve el contenido para restaurarla en el POS sin duplicar. */
export async function claimSuspendedSaleAction(id: string) {
  const ctx = await requireOpenCashSession();
  const sale = await db.retailSale.findFirst({
    where: { id, storeId: ctx.store.id, status: "SUSPENDED" },
    include: {
      items: true,
      customer: { select: { id: true, name: true, documentId: true } },
    },
  });
  if (!sale) throw new Error("Venta en espera no encontrada.");

  await cancelSale(ctx.store.id, sale.id, ctx.userId);
  refresh();

  return {
    id: sale.id,
    code: sale.code,
    customerId: sale.customerId,
    discount: Number(sale.discount),
    note: sale.note,
    items: sale.items
      .filter((item) => item.productId)
      .map((item) => ({
        productId: item.productId!,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
      })),
  };
}
