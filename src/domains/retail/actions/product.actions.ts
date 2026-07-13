"use server";

import { revalidatePath } from "next/cache";
import { requireRetailContext } from "../auth/require-retail-context";
import {
  adjustStock,
  createProduct,
  softDeleteProduct,
  updateProduct,
} from "../services/product.service";
import type { ProductInput } from "../types";

function refresh() {
  revalidatePath("/intiendas", "layout");
}

export async function createProductAction(input: ProductInput) {
  const ctx = await requireRetailContext();
  const product = await createProduct(ctx.storeId, input, ctx.userId);
  refresh();
  return product;
}

export async function updateProductAction(id: string, input: Partial<ProductInput>) {
  const ctx = await requireRetailContext();
  const product = await updateProduct(ctx.storeId, id, input);
  refresh();
  return product;
}

export async function softDeleteProductAction(id: string) {
  const ctx = await requireRetailContext();
  const product = await softDeleteProduct(ctx.storeId, id);
  refresh();
  return product;
}

export async function adjustStockAction(id: string, quantity: number, note?: string) {
  const ctx = await requireRetailContext();
  const product = await adjustStock(ctx.storeId, id, quantity, ctx.userId, note);
  refresh();
  return product;
}
