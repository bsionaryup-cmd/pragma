import { db } from "@/lib/db";
import type { SupplierInput, SupplierProductInput } from "../types";
import { enqueueSupplierUpdated } from "@/domains/retail-intelligence/services/outbox.publisher";

export function listSuppliers(storeId: string) {
  return db.retailSupplier.findMany({
    where: { storeId, deletedAt: null },
    include: { _count: { select: { supplierProducts: true } } },
    orderBy: { name: "asc" },
  });
}

export function createSupplier(storeId: string, input: SupplierInput) {
  if (!input.name.trim()) throw new Error("El nombre es obligatorio");
  return db.retailSupplier.create({
    data: { ...input, storeId, name: input.name.trim() },
  });
}

export async function updateSupplier(storeId: string, id: string, input: Partial<SupplierInput>) {
  const supplier = await db.retailSupplier.findFirst({
    where: { id, storeId, deletedAt: null },
  });
  if (!supplier) throw new Error("Proveedor no encontrado");
  const updated = await db.retailSupplier.update({
    where: { id },
    data: { ...input, name: input.name?.trim() },
  });
  await enqueueSupplierUpdated(db, storeId, id);
  return updated;
}

export async function softDeleteSupplier(storeId: string, id: string) {
  const supplier = await db.retailSupplier.findFirst({
    where: { id, storeId, deletedAt: null },
  });
  if (!supplier) throw new Error("Proveedor no encontrado");
  return db.$transaction([
    db.retailProduct.updateMany({
      where: { storeId, primarySupplierId: id },
      data: { primarySupplierId: null },
    }),
    db.retailProduct.updateMany({
      where: { storeId, secondarySupplierId: id },
      data: { secondarySupplierId: null },
    }),
    db.retailSupplier.update({
      where: { id },
      data: { deletedAt: new Date(), status: "INACTIVE" },
    }),
  ]);
}

export async function upsertSupplierProduct(storeId: string, input: SupplierProductInput) {
  const [supplier, product] = await Promise.all([
    db.retailSupplier.findFirst({
      where: { id: input.supplierId, storeId, deletedAt: null },
    }),
    db.retailProduct.findFirst({
      where: { id: input.productId, storeId, deletedAt: null },
    }),
  ]);
  if (!supplier || !product) throw new Error("Producto o proveedor no encontrado");
  return db.retailSupplierProduct.upsert({
    where: {
      supplierId_productId: { supplierId: input.supplierId, productId: input.productId },
    },
    create: input,
    update: {
      cost: input.cost,
      leadTimeDays: input.leadTimeDays,
      minPurchaseQty: input.minPurchaseQty,
      suggestedPurchaseQty: input.suggestedPurchaseQty,
      lastPrice: input.cost,
    },
  });
}

export function listSupplierProducts(storeId: string, supplierId: string) {
  return db.retailSupplierProduct.findMany({
    where: {
      supplierId,
      supplier: { storeId, deletedAt: null },
      product: { storeId, deletedAt: null },
    },
    include: { product: true },
    orderBy: { product: { name: "asc" } },
  });
}

export {
  listSuppliers as list,
  createSupplier as create,
  updateSupplier as update,
  softDeleteSupplier as softDelete,
};
