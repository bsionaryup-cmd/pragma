import type { Prisma, RetailIntelEventType } from "@prisma/client";
import { db } from "@/lib/db";

type Tx = Prisma.TransactionClient | typeof db;

export type IntelEventInput = {
  storeId: string;
  type: RetailIntelEventType;
  entityType: string;
  entityId?: string | null;
  productIds?: string[];
  payload?: Prisma.InputJsonValue;
};

/** Enqueue an intel event inside the same transaction as the retail write. */
export async function enqueueIntelEvent(tx: Tx, input: IntelEventInput) {
  return tx.retailIntelOutbox.create({
    data: {
      storeId: input.storeId,
      type: input.type,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      productIds: input.productIds ?? [],
      payload: input.payload ?? undefined,
      status: "PENDING",
    },
  });
}

export async function enqueueSaleCompleted(
  tx: Tx,
  storeId: string,
  saleId: string,
  items: Array<{ productId: string; quantity: number; unitPrice: number; unitCost: number }>,
) {
  return enqueueIntelEvent(tx, {
    storeId,
    type: "SALE_COMPLETED",
    entityType: "RetailSale",
    entityId: saleId,
    productIds: items.map((i) => i.productId),
    payload: { items },
  });
}

export async function enqueueSaleCancelled(
  tx: Tx,
  storeId: string,
  saleId: string,
  productIds: string[],
) {
  return enqueueIntelEvent(tx, {
    storeId,
    type: "SALE_CANCELLED",
    entityType: "RetailSale",
    entityId: saleId,
    productIds,
  });
}

export async function enqueuePurchaseReceived(
  tx: Tx,
  storeId: string,
  orderId: string,
  supplierId: string | null,
  productIds: string[],
) {
  return enqueueIntelEvent(tx, {
    storeId,
    type: "PURCHASE_RECEIVED",
    entityType: "RetailPurchaseOrder",
    entityId: orderId,
    productIds,
    payload: { supplierId },
  });
}

export async function enqueueStockChanged(
  tx: Tx,
  storeId: string,
  productId: string,
  kind: "STOCK_ADJUSTED" | "STOCK_TRANSFERRED" | "PRODUCT_UPDATED",
  entityId?: string,
) {
  return enqueueIntelEvent(tx, {
    storeId,
    type: kind,
    entityType: "RetailProduct",
    entityId: entityId ?? productId,
    productIds: [productId],
  });
}

export async function enqueueSupplierUpdated(tx: Tx, storeId: string, supplierId: string) {
  return enqueueIntelEvent(tx, {
    storeId,
    type: "SUPPLIER_UPDATED",
    entityType: "RetailSupplier",
    entityId: supplierId,
  });
}

export async function enqueueRefreshStorePlan(tx: Tx, storeId: string) {
  return enqueueIntelEvent(tx, {
    storeId,
    type: "REFRESH_STORE_PLAN",
    entityType: "RetailStore",
    entityId: storeId,
  });
}
