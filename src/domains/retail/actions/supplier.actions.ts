"use server";

import { revalidatePath } from "next/cache";
import { requireRetailContext } from "../auth/require-retail-context";
import {
  createSupplier,
  softDeleteSupplier,
  updateSupplier,
  upsertSupplierProduct,
} from "../services/supplier.service";
import type { SupplierInput, SupplierProductInput } from "../types";

function refresh() {
  revalidatePath("/intiendas", "layout");
}

export async function createSupplierAction(input: SupplierInput) {
  const ctx = await requireRetailContext();
  const result = await createSupplier(ctx.storeId, input);
  refresh();
  return result;
}

export async function updateSupplierAction(id: string, input: Partial<SupplierInput>) {
  const ctx = await requireRetailContext();
  const result = await updateSupplier(ctx.storeId, id, input);
  refresh();
  return result;
}

export async function softDeleteSupplierAction(id: string) {
  const ctx = await requireRetailContext();
  const result = await softDeleteSupplier(ctx.storeId, id);
  refresh();
  return result;
}

export async function upsertSupplierProductAction(input: SupplierProductInput) {
  const ctx = await requireRetailContext();
  const result = await upsertSupplierProduct(ctx.storeId, input);
  refresh();
  return result;
}
