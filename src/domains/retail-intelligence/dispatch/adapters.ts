import type { DispatchPayload, DispatchResult, OrderDispatchAdapter } from "./port";
import { buildPedidoMessage } from "./message";

export const emailDispatchAdapter: OrderDispatchAdapter = {
  channel: "EMAIL",
  async prepare(payload: DispatchPayload): Promise<DispatchResult> {
    const text = buildPedidoMessage({
      supplierName: payload.supplierName,
      lines: payload.lines,
      orderCode: payload.orderCode,
    });
    return {
      ok: Boolean(payload.supplierEmail),
      channel: "EMAIL",
      message: payload.supplierEmail
        ? `Correo listo para ${payload.supplierEmail}`
        : "Proveedor sin email",
      artifact: {
        to: payload.supplierEmail,
        subject: `Pedido ${payload.orderCode} — ${payload.supplierName}`,
        body: text,
        lineCount: payload.lines.length,
        totalCost: payload.totalCost,
      },
    };
  },
};

export const pdfDispatchAdapter: OrderDispatchAdapter = {
  channel: "PDF",
  async prepare(payload: DispatchPayload): Promise<DispatchResult> {
    const text = buildPedidoMessage({
      supplierName: payload.supplierName,
      lines: payload.lines,
      orderCode: payload.orderCode,
    });
    return {
      ok: true,
      channel: "PDF",
      message: "PDF/texto de pedido preparado",
      artifact: {
        title: `Pedido ${payload.orderCode}`,
        supplier: payload.supplierName,
        lines: payload.lines,
        totalCost: payload.totalCost,
        text,
      },
    };
  },
};

export const whatsappDispatchAdapter: OrderDispatchAdapter = {
  channel: "WHATSAPP",
  async prepare(payload: DispatchPayload): Promise<DispatchResult> {
    const text = buildPedidoMessage({
      supplierName: payload.supplierName,
      lines: payload.lines,
      orderCode: payload.orderCode,
    });
    return {
      ok: Boolean(payload.supplierPhone),
      channel: "WHATSAPP",
      message: payload.supplierPhone
        ? "Mensaje WhatsApp preparado"
        : "Proveedor sin WhatsApp/teléfono",
      artifact: { phone: payload.supplierPhone, text },
    };
  },
};

export const webLinkDispatchAdapter: OrderDispatchAdapter = {
  channel: "WEB_LINK",
  async prepare(payload: DispatchPayload): Promise<DispatchResult> {
    const token = Buffer.from(`${payload.purchaseOrderId}:${payload.storeId}`).toString(
      "base64url",
    );
    return {
      ok: true,
      channel: "WEB_LINK",
      message: "Enlace web firmado preparado",
      artifact: {
        path: `/intiendas/p/${token}`,
        orderId: payload.purchaseOrderId,
      },
    };
  },
};

export const apiDispatchAdapter: OrderDispatchAdapter = {
  channel: "API",
  async prepare(payload: DispatchPayload): Promise<DispatchResult> {
    return {
      ok: true,
      channel: "API",
      message: "Payload API listo (sin envío externo en Phase 1)",
      artifact: {
        orderId: payload.purchaseOrderId,
        supplierId: payload.supplierId,
        lines: payload.lines,
        totalCost: payload.totalCost,
      },
    };
  },
};
