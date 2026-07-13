import { db } from "@/lib/db";
import type { InventoryChangeInput } from "../types";
import { enqueueStockChanged } from "@/domains/retail-intelligence/services/outbox.publisher";

export function listMovements(storeId: string, productId?: string) {
  return db.retailInventoryMovement.findMany({
    where: { storeId, productId },
    include: { product: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
}

async function changeStock(
  storeId: string,
  input: InventoryChangeInput,
  userId: string | undefined,
  type: "ADJUSTMENT" | "RETURN" | "LOSS",
) {
  if (!Number.isInteger(input.quantity) || input.quantity === 0) {
    throw new Error("Cantidad inválida");
  }
  const quantity =
    type === "RETURN" ? Math.abs(input.quantity) :
    type === "LOSS" ? -Math.abs(input.quantity) :
    input.quantity;

  return db.$transaction(async (tx) => {
    const product = await tx.retailProduct.findFirst({
      where: { id: input.productId, storeId, deletedAt: null },
    });
    if (!product || product.stock + quantity < 0) throw new Error("Stock insuficiente");
    const updated = await tx.retailProduct.update({
      where: { id: product.id },
      data: { stock: { increment: quantity } },
    });
    const movement = await tx.retailInventoryMovement.create({
      data: {
        storeId,
        productId: product.id,
        type,
        quantity,
        balanceAfter: updated.stock,
        unitCost: input.unitCost,
        referenceId: input.referenceId,
        note: input.note,
        createdByUserId: userId,
      },
      include: { product: true },
    });
    await enqueueStockChanged(tx, storeId, product.id, "STOCK_ADJUSTED", movement.id);
    return movement;
  });
}

export function createAdjustment(
  storeId: string,
  input: InventoryChangeInput,
  userId?: string,
) {
  return changeStock(storeId, input, userId, input.type ?? "ADJUSTMENT");
}

export function createReturn(storeId: string, input: InventoryChangeInput, userId?: string) {
  return changeStock(storeId, input, userId, "RETURN");
}
