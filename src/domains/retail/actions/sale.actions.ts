"use server";

import { revalidatePath } from "next/cache";
import { requireRetailContext } from "../auth/require-retail-context";
import { cancelSale, createSale, suspendSale } from "../services/sale.service";
import type { SaleInput } from "../types";

function refresh() {
  revalidatePath("/intiendas", "layout");
}

export async function createSaleAction(input: SaleInput) {
  const ctx = await requireRetailContext();
  const result = await createSale(ctx.storeId, input, ctx.userId);
  refresh();
  return result;
}

export async function suspendSaleAction(input: SaleInput) {
  const ctx = await requireRetailContext();
  const result = await suspendSale(ctx.storeId, input, ctx.userId);
  refresh();
  return result;
}

export async function cancelSaleAction(id: string) {
  const ctx = await requireRetailContext();
  const result = await cancelSale(ctx.storeId, id, ctx.userId);
  refresh();
  return result;
}
