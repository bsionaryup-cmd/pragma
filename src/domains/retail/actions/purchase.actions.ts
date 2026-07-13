"use server";

import { revalidatePath } from "next/cache";
import { requireRetailContext } from "../auth/require-retail-context";
import {
  approveOrder,
  cancelOrder,
  createDraftOrder,
  receiveOrder,
} from "../services/purchase.service";
import type { PurchaseOrderInput, ReceivePurchaseItemInput } from "../types";

function refresh() {
  revalidatePath("/intiendas", "layout");
}

export async function createDraftOrderAction(input: PurchaseOrderInput) {
  const ctx = await requireRetailContext();
  const result = await createDraftOrder(ctx.store.id, input, ctx.userId);
  refresh();
  return result;
}

export async function approveOrderAction(id: string) {
  const ctx = await requireRetailContext();
  const result = await approveOrder(ctx.store.id, id);
  refresh();
  return result;
}

export async function receiveOrderAction(id: string, items?: ReceivePurchaseItemInput[]) {
  const ctx = await requireRetailContext();
  const result = await receiveOrder(ctx.store.id, id, items, ctx.userId);
  refresh();
  return result;
}

export async function cancelOrderAction(id: string) {
  const ctx = await requireRetailContext();
  const result = await cancelOrder(ctx.store.id, id);
  refresh();
  return result;
}
