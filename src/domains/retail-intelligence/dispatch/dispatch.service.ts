import type { RetailDispatchChannel } from "@prisma/client";
import { db } from "@/lib/db";
import {
  apiDispatchAdapter,
  emailDispatchAdapter,
  pdfDispatchAdapter,
  webLinkDispatchAdapter,
  whatsappDispatchAdapter,
} from "./adapters";
import type { DispatchPayload, OrderDispatchAdapter } from "./port";

const adapters: Record<RetailDispatchChannel, OrderDispatchAdapter> = {
  EMAIL: emailDispatchAdapter,
  PDF: pdfDispatchAdapter,
  WHATSAPP: whatsappDispatchAdapter,
  WEB_LINK: webLinkDispatchAdapter,
  API: apiDispatchAdapter,
};

export function resolveDispatchChannel(
  preferred: RetailDispatchChannel | null | undefined,
): RetailDispatchChannel {
  return preferred ?? "EMAIL";
}

/** Prepare dispatch artifacts for an approved order. Does not send externally in Phase 1. */
export async function prepareOrderDispatch(storeId: string, purchaseOrderId: string) {
  const order = await db.retailPurchaseOrder.findFirst({
    where: { id: purchaseOrderId, storeId },
    include: {
      supplier: true,
      items: true,
    },
  });
  if (!order) throw new Error("Pedido no encontrado");
  if (!["APPROVED", "SENT"].includes(order.status)) {
    throw new Error("El pedido debe estar aprobado para preparar el envío");
  }

  const channel = resolveDispatchChannel(order.supplier?.preferredDispatchChannel);
  const whatsappOrPhone = order.supplier?.whatsapp || order.supplier?.phone || null;
  const payload: DispatchPayload = {
    storeId,
    purchaseOrderId: order.id,
    supplierId: order.supplierId,
    supplierName: order.supplier?.name ?? "Sin proveedor",
    supplierEmail: order.supplier?.email ?? null,
    supplierPhone: whatsappOrPhone,
    channel,
    lines: order.items.map((item) => ({
      productName: item.productName,
      quantity: item.quantity,
      unitCost: Number(item.unitCost),
    })),
    totalCost: Number(order.totalCost),
    orderCode: order.code,
  };

  const primary = await adapters[channel].prepare(payload);
  const pdf = await adapters.PDF.prepare({ ...payload, channel: "PDF" });
  const web = await adapters.WEB_LINK.prepare({ ...payload, channel: "WEB_LINK" });
  const wa = await adapters.WHATSAPP.prepare({ ...payload, channel: "WHATSAPP" });

  const job = await db.retailOrderDispatchJob.create({
    data: {
      storeId,
      purchaseOrderId: order.id,
      supplierId: order.supplierId,
      channel,
      status: "READY",
      payloadJson: payload as object,
      resultJson: {
        primary,
        pdf,
        webLink: web,
        whatsapp: wa,
      } as object,
      preparedAt: new Date(),
    },
  });

  if (order.status === "APPROVED") {
    await db.retailPurchaseOrder.update({
      where: { id: order.id },
      data: { status: "SENT" },
    });
  }

  return { job, primary, pdf, web, wa };
}
