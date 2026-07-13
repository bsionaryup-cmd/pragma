"use server";

import { revalidatePath } from "next/cache";
import { requireRetailContext } from "../auth/require-retail-context";
import {
  createCategory,
  softDeleteCategory,
  updateCategory,
} from "../services/category.service";
import type { CategoryInput } from "../types";

function refresh() {
  revalidatePath("/intiendas", "layout");
}

export async function createCategoryAction(input: CategoryInput) {
  const ctx = await requireRetailContext();
  const result = await createCategory(ctx.storeId, input);
  refresh();
  return result;
}

export async function updateCategoryAction(id: string, input: Partial<CategoryInput>) {
  const ctx = await requireRetailContext();
  const result = await updateCategory(ctx.storeId, id, input);
  refresh();
  return result;
}

export async function softDeleteCategoryAction(id: string) {
  const ctx = await requireRetailContext();
  const result = await softDeleteCategory(ctx.storeId, id);
  refresh();
  return result;
}
