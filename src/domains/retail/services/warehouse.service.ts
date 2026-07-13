import { db } from "@/lib/db";
import { enqueueStockChanged } from "@/domains/retail-intelligence/services/outbox.publisher";

export async function ensureDefaultWarehouse(storeId: string) {
  const existing = await db.retailWarehouse.findFirst({
    where: { storeId, deletedAt: null, isDefault: true },
  });
  if (existing) return existing;
  return db.retailWarehouse.create({
    data: { storeId, name: "Principal", isDefault: true },
  });
}

export async function listWarehouses(storeId: string) {
  await ensureDefaultWarehouse(storeId);
  return db.retailWarehouse.findMany({
    where: { storeId, deletedAt: null, status: "ACTIVE" },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
}

export async function createWarehouse(storeId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("El nombre de la bodega es obligatorio.");
  await ensureDefaultWarehouse(storeId);
  return db.retailWarehouse.create({
    data: { storeId, name: trimmed, isDefault: false },
  });
}

export async function updateWarehouse(storeId: string, id: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("El nombre de la bodega es obligatorio.");
  const warehouse = await db.retailWarehouse.findFirst({
    where: { id, storeId, deletedAt: null },
  });
  if (!warehouse) throw new Error("Bodega no encontrada.");
  return db.retailWarehouse.update({
    where: { id },
    data: { name: trimmed },
  });
}

export async function softDeleteWarehouse(storeId: string, id: string) {
  const warehouse = await db.retailWarehouse.findFirst({
    where: { id, storeId, deletedAt: null },
  });
  if (!warehouse) throw new Error("Bodega no encontrada.");
  if (warehouse.isDefault) throw new Error("No se puede eliminar la bodega principal.");
  return db.retailWarehouse.update({
    where: { id },
    data: { deletedAt: new Date(), status: "INACTIVE" },
  });
}

async function getOrCreateStock(
  // Prisma interactive transaction client
  tx: {
    retailWarehouseStock: {
      findUnique: typeof db.retailWarehouseStock.findUnique;
      create: typeof db.retailWarehouseStock.create;
    };
  },
  warehouseId: string,
  productId: string,
) {
  const existing = await tx.retailWarehouseStock.findUnique({
    where: { warehouseId_productId: { warehouseId, productId } },
  });
  if (existing) return existing;
  return tx.retailWarehouseStock.create({
    data: { warehouseId, productId, quantity: 0 },
  });
}

export async function transferStock(input: {
  storeId: string;
  productId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  quantity: number;
  userId?: string;
}) {
  const qty = Math.trunc(input.quantity);
  if (qty <= 0) throw new Error("La cantidad debe ser positiva.");
  if (input.fromWarehouseId === input.toWarehouseId) {
    throw new Error("Selecciona bodegas diferentes.");
  }

  return db.$transaction(async (tx) => {
    const [product, fromWh, toWh] = await Promise.all([
      tx.retailProduct.findFirst({
        where: { id: input.productId, storeId: input.storeId, deletedAt: null },
      }),
      tx.retailWarehouse.findFirst({
        where: { id: input.fromWarehouseId, storeId: input.storeId, deletedAt: null },
      }),
      tx.retailWarehouse.findFirst({
        where: { id: input.toWarehouseId, storeId: input.storeId, deletedAt: null },
      }),
    ]);
    if (!product) throw new Error("Producto no encontrado.");
    if (!fromWh || !toWh) throw new Error("Bodega no encontrada.");

    const fromStock = await getOrCreateStock(tx, fromWh.id, product.id);
    // Si la bodega origen es principal y no tiene stock asignado, usa stock global una vez.
    let available = fromStock.quantity;
    if (fromWh.isDefault && available === 0 && product.stock > 0) {
      await tx.retailWarehouseStock.update({
        where: { id: fromStock.id },
        data: { quantity: product.stock },
      });
      available = product.stock;
    }
    if (available < qty) throw new Error("Stock insuficiente en la bodega origen.");

    await tx.retailWarehouseStock.update({
      where: { id: fromStock.id },
      data: { quantity: { decrement: qty } },
    });
    const toStock = await getOrCreateStock(tx, toWh.id, product.id);
    await tx.retailWarehouseStock.update({
      where: { id: toStock.id },
      data: { quantity: { increment: qty } },
    });

    await tx.retailInventoryMovement.create({
      data: {
        storeId: input.storeId,
        productId: product.id,
        type: "TRANSFER",
        quantity: 0,
        balanceAfter: product.stock,
        note: `Traslado ${qty} und: ${fromWh.name} → ${toWh.name}`,
        createdByUserId: input.userId,
      },
    });

    await enqueueStockChanged(tx, input.storeId, product.id, "STOCK_TRANSFERRED");

    return { ok: true as const };
  });
}
