"use server";

import { revalidatePath } from "next/cache";
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
