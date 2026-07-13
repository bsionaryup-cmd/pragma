import type { RetailDispatchChannel } from "@prisma/client";

export type DispatchPayload = {
  storeId: string;
  purchaseOrderId: string;
  supplierId: string | null;
  supplierName: string;
  supplierEmail: string | null;
  supplierPhone: string | null;
  channel: RetailDispatchChannel;
  lines: Array<{ productName: string; quantity: number; unitCost: number }>;
  totalCost: number;
  orderCode: string;
};

export type DispatchResult = {
  ok: boolean;
  channel: RetailDispatchChannel;
  message: string;
  artifact?: Record<string, unknown>;
};

export interface OrderDispatchAdapter {
  channel: RetailDispatchChannel;
  prepare(payload: DispatchPayload): Promise<DispatchResult>;
}
