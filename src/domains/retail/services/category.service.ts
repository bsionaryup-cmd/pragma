import { db } from "@/lib/db";
import type { CategoryInput } from "../types";

export function listCategories(storeId: string) {
  return db.retailCategory.findMany({
    where: { storeId, deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export function createCategory(storeId: string, input: CategoryInput) {
  if (!input.name.trim()) throw new Error("El nombre es obligatorio");
  return db.retailCategory.create({
    data: { storeId, name: input.name.trim(), sortOrder: input.sortOrder ?? 0 },
  });
}

export async function updateCategory(storeId: string, id: string, input: Partial<CategoryInput>) {
  const category = await db.retailCategory.findFirst({
    where: { id, storeId, deletedAt: null },
  });
  if (!category) throw new Error("Categoría no encontrada");
  return db.retailCategory.update({
    where: { id },
    data: { name: input.name?.trim(), sortOrder: input.sortOrder },
  });
}

export async function softDeleteCategory(storeId: string, id: string) {
  const category = await db.retailCategory.findFirst({
    where: { id, storeId, deletedAt: null },
  });
  if (!category) throw new Error("Categoría no encontrada");
  return db.$transaction([
    db.retailProduct.updateMany({ where: { storeId, categoryId: id }, data: { categoryId: null } }),
    db.retailCategory.update({
      where: { id },
      data: { deletedAt: new Date(), status: "INACTIVE" },
    }),
  ]);
}

export {
  listCategories as list,
  createCategory as create,
  updateCategory as update,
  softDeleteCategory as softDelete,
};
