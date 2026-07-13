"use server";

import { revalidatePath } from "next/cache";
import { requireRetailContext } from "../auth/require-retail-context";
import { createAdjustment, createReturn } from "../services/inventory.service";
import type { InventoryChangeInput } from "../types";

function refresh() {
  revalidatePath("/intiendas", "layout");
}

export async function createAdjustmentAction(input: InventoryChangeInput) {
  const ctx = await requireRetailContext();
  const result = await createAdjustment(ctx.storeId, input, ctx.userId);
  refresh();
  return result;
}

export async function createReturnAction(input: InventoryChangeInput) {
  const ctx = await requireRetailContext();
  const result = await createReturn(ctx.storeId, input, ctx.userId);
  refresh();
  return result;
}
