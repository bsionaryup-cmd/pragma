"use client";

import { useMemo, useState } from "react";
import {
  approvePedidoAction,
  changePedidoSupplierAction,
  dismissPedidoAction,
  markPedidoSentAction,
  updatePedidoItemsAction,
} from "@/domains/retail/actions/pedidos.actions";
import { formatIntiendasMoney } from "@/domains/retail/ui/tiendas-on/format";
import { TiendasOnPrimaryButton } from "@/domains/retail/ui/tiendas-on/controls";

type OrderItem = {
  id: string;
  productId: string | null;
  productName: string;
  quantity: number;
  unitCost: number;
  lineTotal: number;
  stock: number;
  suggestedQty: number;
  daysOfCover: number | null;
  decision: string;
  motivo: string;
  details: Array<{ label: string; value: string }>;
};

type Order = {
  id: string;
  code: string;
  status: string;
  statusLabel: string;
  notes: string | null;
  totalCost: number;
  productCount: number;
  visualPriority: "URGENT" | "SOON" | "NORMAL";
  visualPriorityLabel: string;
  recommendedAction: string;
  estimatedCoverageDays: number | null;
  leadTimeDays: number;
  message: string;
  whatsappUrl: string | null;
  mailtoUrl: string | null;
  supplier: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    whatsapp: string | null;
    leadTimeDays: number;
    usualDeliveryDows: string | null;
  } | null;
  items: OrderItem[];
};

type Briefing = {
  greeting: string;
  lines: Array<{ tone: "urgent" | "watch" | "ok"; text: string }>;
  recommendedAction: string | null;
};

const TONE_DOT: Record<string, string> = {
  urgent: "bg-red-500",
  watch: "bg-amber-400",
  ok: "bg-emerald-500",
};

const PRIORITY_STYLE: Record<string, string> = {
  URGENT: "border-red-200 bg-red-50 text-red-800",
  SOON: "border-amber-200 bg-amber-50 text-amber-900",
  NORMAL: "border-emerald-200 bg-emerald-50 text-emerald-900",
};

export function PedidosIntelClient({
  briefing,
  orders,
  suppliers,
  products,
  cashOpen,
}: {
  briefing: Briefing;
  orders: Order[];
  suppliers: Array<{ id: string; name: string }>;
  products: Array<{ id: string; name: string; cost: number; stock: number }>;
  cashOpen: boolean;
}) {
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const [addProductId, setAddProductId] = useState("");
  const [copied, setCopied] = useState(false);

  const reviewOrder = useMemo(
    () => orders.find((o) => o.id === reviewId) ?? null,
    [orders, reviewId],
  );
  const previewOrder = useMemo(
    () => orders.find((o) => o.id === previewId) ?? null,
    [orders, previewId],
  );

  function openReview(order: Order) {
    setReviewId(order.id);
    setEditing(false);
    setNotes(order.notes ?? "");
    const next: Record<string, number> = {};
    for (const item of order.items) {
      if (item.productId) next[item.productId] = item.quantity;
    }
    setQtyMap(next);
  }

  async function saveEdit() {
    if (!reviewOrder) return;
    const items = Object.entries(qtyMap)
      .filter(([, qty]) => qty > 0)
      .map(([productId, quantity]) => ({
        productId,
        quantity,
        unitCost: products.find((p) => p.id === productId)?.cost,
      }));
    const fd = new FormData();
    fd.set("orderId", reviewOrder.id);
    fd.set("itemsJson", JSON.stringify(items));
    fd.set("notes", notes);
    await updatePedidoItemsAction(fd);
    setEditing(false);
  }

  async function copyMessage(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function confirmSend(channel: "whatsapp" | "email" | "copy") {
    if (!previewOrder) return;
    const fd = new FormData();
    fd.set("id", previewOrder.id);
    await markPedidoSentAction(fd);
    if (channel === "whatsapp" && previewOrder.whatsappUrl) {
      window.open(previewOrder.whatsappUrl, "_blank", "noopener,noreferrer");
    } else if (channel === "email" && previewOrder.mailtoUrl) {
      window.location.href = previewOrder.mailtoUrl;
    } else if (channel === "copy") {
      await copyMessage(previewOrder.message);
    }
    setPreviewId(null);
    setReviewId(null);
  }

  return (
    <div className="space-y-4 p-4">
      <section className="rounded-lg border border-[#d5dce6] bg-white p-5">
        <p className="text-2xl font-semibold text-[#2d3748]">{briefing.greeting}</p>
        <p className="mt-1 text-sm font-medium text-[#718096]">Hoy recomendamos</p>
        <ul className="mt-3 space-y-2">
          {briefing.lines.map((line) => (
            <li key={line.text} className="flex items-start gap-2 text-base text-[#2d3748]">
              <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${TONE_DOT[line.tone]}`} />
              <span>{line.text}</span>
            </li>
          ))}
        </ul>
        {briefing.recommendedAction ? (
          <p className="mt-4 rounded-md bg-pragma-electric/5 px-3 py-2 text-sm font-medium text-pragma-electric">
            Acción recomendada: {briefing.recommendedAction}
          </p>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[#2d3748]">Pedidos sugeridos</h2>
        {!orders.length ? (
          <p className="rounded-lg border border-[#d5dce6] bg-white p-4 text-[#718096]">
            No hay pedidos pendientes. El sistema generará sugerencias automáticamente cuando haya
            riesgo de agotamiento.
          </p>
        ) : null}

        {orders.map((order) => (
          <article key={order.id} className="rounded-lg border border-[#d5dce6] bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-[#718096]">Proveedor</p>
                <h3 className="text-xl font-semibold text-[#2d3748]">
                  {order.supplier?.name ?? "Sin proveedor"}
                </h3>
                <p className="mt-1 text-sm text-[#718096]">
                  {order.productCount} producto{order.productCount === 1 ? "" : "s"}
                  {order.estimatedCoverageDays != null
                    ? ` · cobertura ~${order.estimatedCoverageDays}d`
                    : ""}
                  {` · ${order.statusLabel}`}
                </p>
                <p className="mt-1 text-sm text-[#4a5568]">{order.recommendedAction}</p>
              </div>
              <div className="text-right">
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${PRIORITY_STYLE[order.visualPriority]}`}
                >
                  {order.visualPriority === "URGENT"
                    ? "Urgente"
                    : order.visualPriority === "SOON"
                      ? "Pronto"
                      : "Normal"}
                </span>
                <p className="mt-2 text-lg font-semibold text-pragma-electric">
                  {formatIntiendasMoney(order.totalCost)}
                </p>
              </div>
            </div>
            <div className="mt-4">
              <TiendasOnPrimaryButton
                type="button"
                className="h-10 px-4 text-sm"
                onClick={() => openReview(order)}
              >
                Revisar
              </TiendasOnPrimaryButton>
            </div>
          </article>
        ))}
      </section>

      {reviewOrder ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-lg bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase text-[#718096]">Revisar pedido</p>
                <h3 className="text-xl font-semibold text-[#2d3748]">
                  {reviewOrder.supplier?.name ?? "Sin proveedor"}
                </h3>
                <p className="text-sm text-[#718096]">
                  {reviewOrder.code} · {formatIntiendasMoney(reviewOrder.totalCost)}
                </p>
              </div>
              <button
                type="button"
                className="text-sm text-[#718096]"
                onClick={() => {
                  setReviewId(null);
                  setEditing(false);
                }}
              >
                Cerrar
              </button>
            </div>

            {!editing ? (
              <ul className="mt-4 divide-y divide-[#edf2f7]">
                {reviewOrder.items.map((item) => (
                  <li key={item.id} className="py-3">
                    <div className="flex justify-between gap-2">
                      <p className="font-medium text-[#2d3748]">{item.productName}</p>
                      <p className="text-sm font-medium">x{item.quantity}</p>
                    </div>
                    <p className="mt-1 text-sm text-pragma-electric">{item.decision}</p>
                    <p className="text-sm text-[#718096]">{item.motivo}</p>
                    <dl className="mt-2 grid grid-cols-2 gap-1 text-xs text-[#4a5568] sm:grid-cols-3">
                      {item.details.map((d) => (
                        <div key={d.label}>
                          <dt className="text-[#a0aec0]">{d.label}</dt>
                          <dd className="font-medium">{d.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-4 space-y-3">
                {reviewOrder.items.map((item) =>
                  item.productId ? (
                    <div key={item.id} className="flex flex-wrap items-center gap-2 border-b py-2">
                      <span className="min-w-0 flex-1 text-sm">{item.productName}</span>
                      <input
                        type="number"
                        min={0}
                        className="h-9 w-20 rounded border px-2"
                        value={qtyMap[item.productId] ?? 0}
                        onChange={(e) =>
                          setQtyMap((prev) => ({
                            ...prev,
                            [item.productId!]: Number(e.target.value),
                          }))
                        }
                      />
                      <button
                        type="button"
                        className="text-xs text-[#718096]"
                        onClick={() =>
                          setQtyMap((prev) => {
                            const next = { ...prev };
                            delete next[item.productId!];
                            return next;
                          })
                        }
                      >
                        Quitar
                      </button>
                    </div>
                  ) : null,
                )}
                <div className="flex flex-wrap gap-2">
                  <select
                    className="h-9 rounded border px-2 text-sm"
                    value={addProductId}
                    onChange={(e) => setAddProductId(e.target.value)}
                  >
                    <option value="">Agregar…</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="text-sm text-pragma-electric"
                    onClick={() => {
                      if (!addProductId) return;
                      setQtyMap((prev) => ({ ...prev, [addProductId]: prev[addProductId] ?? 1 }));
                      setAddProductId("");
                    }}
                  >
                    Agregar
                  </button>
                </div>
                <form action={changePedidoSupplierAction} className="flex flex-wrap gap-2">
                  <input type="hidden" name="orderId" value={reviewOrder.id} />
                  <select
                    name="supplierId"
                    defaultValue={reviewOrder.supplier?.id ?? ""}
                    className="h-9 rounded border px-2 text-sm"
                  >
                    <option value="">Sin proveedor</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="text-sm text-pragma-electric">
                    Cambiar proveedor
                  </button>
                </form>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded border px-3 py-2 text-sm"
                  placeholder="Observaciones"
                />
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-2 border-t pt-4">
              {!editing ? (
                <>
                  <TiendasOnPrimaryButton
                    type="button"
                    className="h-10 px-4 text-sm"
                    disabled={!cashOpen}
                    onClick={() => setEditing(true)}
                  >
                    Editar
                  </TiendasOnPrimaryButton>
                  <form action={approvePedidoAction}>
                    <input type="hidden" name="id" value={reviewOrder.id} />
                    <TiendasOnPrimaryButton
                      type="submit"
                      className="h-10 px-4 text-sm"
                      disabled={!cashOpen}
                    >
                      Aprobar
                    </TiendasOnPrimaryButton>
                  </form>
                  <TiendasOnPrimaryButton
                    type="button"
                    className="h-10 px-4 text-sm"
                    disabled={!cashOpen}
                    onClick={() => setPreviewId(reviewOrder.id)}
                  >
                    Enviar
                  </TiendasOnPrimaryButton>
                  <form action={dismissPedidoAction}>
                    <input type="hidden" name="id" value={reviewOrder.id} />
                    <button type="submit" disabled={!cashOpen} className="h-10 px-3 text-sm text-[#718096]">
                      Descartar
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <TiendasOnPrimaryButton
                    type="button"
                    className="h-10 px-4 text-sm"
                    onClick={saveEdit}
                  >
                    Guardar
                  </TiendasOnPrimaryButton>
                  <button type="button" className="text-sm text-[#718096]" onClick={() => setEditing(false)}>
                    Cancelar
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {previewOrder ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-[#2d3748]">Previsualización de envío</h3>
            <p className="mt-1 text-sm text-[#718096]">
              {previewOrder.supplier?.name ?? "Sin proveedor"} ·{" "}
              {formatIntiendasMoney(previewOrder.totalCost)}
            </p>
            <ul className="mt-3 max-h-40 space-y-1 overflow-auto text-sm text-[#2d3748]">
              {previewOrder.items.map((item) => (
                <li key={item.id}>
                  {item.productName} × {item.quantity}
                </li>
              ))}
            </ul>
            {previewOrder.notes ? (
              <p className="mt-2 text-sm text-[#718096]">Observaciones: {previewOrder.notes}</p>
            ) : null}
            <pre className="mt-3 max-h-48 overflow-auto rounded bg-[#f8fafc] p-3 text-xs whitespace-pre-wrap text-[#4a5568]">
              {previewOrder.message}
            </pre>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="h-10 rounded-md border px-4 text-sm"
                onClick={() => copyMessage(previewOrder.message)}
              >
                {copied ? "Copiado" : "Copiar"}
              </button>
              {previewOrder.whatsappUrl ? (
                <TiendasOnPrimaryButton
                  type="button"
                  className="h-10 px-4 text-sm"
                  onClick={() => confirmSend("whatsapp")}
                >
                  WhatsApp
                </TiendasOnPrimaryButton>
              ) : null}
              {previewOrder.mailtoUrl ? (
                <button
                  type="button"
                  className="h-10 rounded-md border border-pragma-electric px-4 text-sm text-pragma-electric"
                  onClick={() => confirmSend("email")}
                >
                  Correo
                </button>
              ) : null}
              <button
                type="button"
                className="h-10 px-3 text-sm text-[#718096]"
                onClick={() => setPreviewId(null)}
              >
                Cancelar
              </button>
            </div>
            {!previewOrder.whatsappUrl && !previewOrder.mailtoUrl ? (
              <p className="mt-2 text-xs text-[#a0aec0]">
                Agrega WhatsApp o correo al proveedor para habilitar el envío.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
