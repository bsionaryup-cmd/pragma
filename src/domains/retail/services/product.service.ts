import { db } from "@/lib/db";
import { enqueueStockChanged } from "@/domains/retail-intelligence/services/outbox.publisher";
import {
  assertStoreOwnedCategory,
  assertStoreOwnedSupplier,
} from "@/domains/retail/lib/store-owned";
import type { ProductInput } from "../types";

const productInclude = {
  category: true,
  primarySupplier: true,
  secondarySupplier: true,
} as const;

export function listProducts(storeId: string) {
  return db.retailProduct.findMany({
    where: { storeId, deletedAt: null },
    include: productInclude,
    orderBy: { name: "asc" },
  });
}

export function searchProducts(storeId: string, q: string) {
  const query = q.trim();
  return db.retailProduct.findMany({
    where: {
      storeId,
      deletedAt: null,
      status: "ACTIVE",
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { sku: { contains: query, mode: "insensitive" } },
        { barcode: { contains: query, mode: "insensitive" } },
      ],
    },
    include: productInclude,
    orderBy: { name: "asc" },
    take: 50,
  });
}

export async function getProduct(storeId: string, id: string) {
  const product = await db.retailProduct.findFirst({
    where: { id, storeId, deletedAt: null },
    include: { ...productInclude, supplierProducts: { include: { supplier: true } } },
  });
  if (!product) throw new Error("Producto no encontrado");
  return product;
}

export async function createProduct(storeId: string, input: ProductInput, userId?: string) {
  if (!input.name.trim()) throw new Error("El nombre es obligatorio");
  const stock = Math.max(0, Math.trunc(input.stock ?? 0));
  const categoryId = await assertStoreOwnedCategory(storeId, input.categoryId);
  const primarySupplierId = await assertStoreOwnedSupplier(storeId, input.primarySupplierId);
  const secondarySupplierId = await assertStoreOwnedSupplier(
    storeId,
    input.secondarySupplierId,
  );

  return db.$transaction(async (tx) => {
    const product = await tx.retailProduct.create({
      data: {
        ...input,
        storeId,
        name: input.name.trim(),
        sku: input.sku?.trim() || null,
        barcode: input.barcode?.trim() || null,
        categoryId,
        primarySupplierId,
        secondarySupplierId,
        cost: input.cost ?? 0,
        price: input.price ?? 0,
        stock,
      },
    });
    if (stock > 0) {
      await tx.retailInventoryMovement.create({
        data: {
          storeId,
          productId: product.id,
          type: "INITIAL",
          quantity: stock,
          balanceAfter: stock,
          unitCost: product.cost,
          createdByUserId: userId,
        },
      });
    }
    return product;
  });
}

export async function updateProduct(storeId: string, id: string, input: Partial<ProductInput>) {
  await getProduct(storeId, id);
  const data = { ...input };
  delete data.stock;
  if (data.categoryId !== undefined) {
    data.categoryId = await assertStoreOwnedCategory(storeId, data.categoryId);
  }
  if (data.primarySupplierId !== undefined) {
    data.primarySupplierId = await assertStoreOwnedSupplier(storeId, data.primarySupplierId);
  }
  if (data.secondarySupplierId !== undefined) {
    data.secondarySupplierId = await assertStoreOwnedSupplier(
      storeId,
      data.secondarySupplierId,
    );
  }
  const updated = await db.retailProduct.update({
    where: { id },
    data: {
      ...data,
      name: data.name?.trim(),
      sku: data.sku === undefined ? undefined : data.sku?.trim() || null,
      barcode: data.barcode === undefined ? undefined : data.barcode?.trim() || null,
    },
  });
  await enqueueStockChanged(db, storeId, id, "PRODUCT_UPDATED");
  return updated;
}

export async function softDeleteProduct(storeId: string, id: string) {
  await getProduct(storeId, id);
  return db.retailProduct.update({
    where: { id },
    data: { deletedAt: new Date(), status: "INACTIVE" },
  });
}

export async function adjustStock(
  storeId: string,
  productId: string,
  quantity: number,
  userId?: string,
  note?: string,
) {
  if (!Number.isInteger(quantity) || quantity === 0) throw new Error("Cantidad inválida");
  return db.$transaction(async (tx) => {
    const product = await tx.retailProduct.findFirst({
      where: { id: productId, storeId, deletedAt: null },
    });
    if (!product || product.stock + quantity < 0) throw new Error("Stock insuficiente");
    const updated = await tx.retailProduct.update({
      where: { id: productId },
      data: { stock: { increment: quantity } },
    });
    await tx.retailInventoryMovement.create({
      data: {
        storeId,
        productId,
        type: "ADJUSTMENT",
        quantity,
        balanceAfter: updated.stock,
        note,
        createdByUserId: userId,
      },
    });
    await enqueueStockChanged(tx, storeId, productId, "STOCK_ADJUSTED");
    return updated;
  });
}

export function listFavorites(storeId: string) {
  return db.retailProduct.findMany({
    where: { storeId, deletedAt: null, status: "ACTIVE", isFavorite: true },
    include: productInclude,
    orderBy: { name: "asc" },
  });
}

export function listCriticalStock(storeId: string) {
  return db.$queryRaw<
    Array<{ id: string; name: string; stock: number; minStock: number; idealStock: number }>
  >`SELECT id, name, stock, min_stock AS "minStock", ideal_stock AS "idealStock"
    FROM retail_products
    WHERE store_id = ${storeId} AND deleted_at IS NULL
      AND status = 'ACTIVE' AND stock <= min_stock
    ORDER BY stock ASC, name ASC`;
}
