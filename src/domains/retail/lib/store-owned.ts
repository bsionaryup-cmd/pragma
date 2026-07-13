import "server-only";

import { db } from "@/lib/db";

/** Ensures related retail entity IDs belong to the caller's store (cross-store FK hard stop). */
export async function assertStoreOwnedCategory(
  storeId: string,
  categoryId: string | null | undefined,
): Promise<string | null> {
  if (!categoryId) return null;
  const row = await db.retailCategory.findFirst({
    where: { id: categoryId, storeId, deletedAt: null },
    select: { id: true },
  });
  if (!row) throw new Error("Categoría no válida para esta tienda.");
  return row.id;
}

export async function assertStoreOwnedSupplier(
  storeId: string,
  supplierId: string | null | undefined,
): Promise<string | null> {
  if (!supplierId) return null;
  const row = await db.retailSupplier.findFirst({
    where: { id: supplierId, storeId, deletedAt: null },
    select: { id: true },
  });
  if (!row) throw new Error("Proveedor no válido para esta tienda.");
  return row.id;
}

export async function assertStoreOwnedCashRegister(
  storeId: string,
  registerId: string,
): Promise<string> {
  const row = await db.retailCashRegister.findFirst({
    where: { id: registerId, storeId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!row) throw new Error("Caja no encontrada.");
  return row.id;
}
