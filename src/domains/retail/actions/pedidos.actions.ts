"use server";

import { revalidatePath } from "next/cache";
import { requireOpenCashSession } from "@/domains/retail/auth/require-open-cash";
import { requireRetailContext } from "@/domains/retail/auth/require-retail-context";
import {
  approveIntelOrder,
  changeOrderSupplier,
  dismissIntelOrder,
  sendIntelOrder,
  updateSuggestedOrderItems,
} from "@/domains/retail-intelligence";
import { drainIntelOutbox, ensureStoreIntelligence } from "@/domains/retail-intelligence";

function refresh() {
  revalidatePath("/intiendas", "layout");
}

export async function refreshPedidosIntelligenceAction() {
  const ctx = await requireRetailContext();
  await ensureStoreIntelligence(ctx.store.id);
  await drainIntelOutbox(200);
  refresh();
}

export async function approvePedidoAction(formData: FormData) {
  const ctx = await requireOpenCashSession();
  const id = String(formData.get("id") ?? "");
  await approveIntelOrder(ctx.store.id, id, ctx.userId);
  refresh();
}

export async function markPedidoSentAction(formData: FormData) {
  const ctx = await requireOpenCashSession();
  const id = String(formData.get("id") ?? "");
  await sendIntelOrder(ctx.store.id, id, ctx.userId);
  refresh();
}

export async function dismissPedidoAction(formData: FormData) {
  const ctx = await requireOpenCashSession();
  const id = String(formData.get("id") ?? "");
  await dismissIntelOrder(ctx.store.id, id);
  refresh();
}

export async function updatePedidoItemsAction(formData: FormData) {
  const ctx = await requireOpenCashSession();
  const orderId = String(formData.get("orderId") ?? "");
  const raw = String(formData.get("itemsJson") ?? "[]");
  const notes = String(formData.get("notes") ?? "");
  const items = JSON.parse(raw) as Array<{
    productId: string;
    quantity: number;
    unitCost?: number;
  }>;
  await updateSuggestedOrderItems(ctx.store.id, orderId, items, notes);
  refresh();
}

export async function changePedidoSupplierAction(formData: FormData) {
  const ctx = await requireOpenCashSession();
  const orderId = String(formData.get("orderId") ?? "");
  const supplierId = String(formData.get("supplierId") ?? "") || null;
  await changeOrderSupplier(ctx.store.id, orderId, supplierId);
  refresh();
}
