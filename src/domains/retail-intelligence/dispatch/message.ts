/** Build human-reviewed outbound messages for Pedidos (no auto-send). */

export type PedidoMessageLine = {
  productName: string;
  quantity: number;
};

export function buildPedidoMessage(input: {
  supplierName: string;
  lines: PedidoMessageLine[];
  orderCode?: string;
  notes?: string | null;
}) {
  const products = input.lines
    .map((line) => `• ${line.productName} x${line.quantity}`)
    .join("\n");
  const parts = [
    "Buenos días.",
    "",
    "Adjunto nuestro pedido sugerido.",
    "",
    `Proveedor: ${input.supplierName}`,
  ];
  if (input.orderCode) parts.push(`Pedido: ${input.orderCode}`);
  parts.push("", "Productos:", products || "• (sin líneas)");
  if (input.notes?.trim()) {
    parts.push("", `Observaciones: ${input.notes.trim()}`);
  }
  parts.push("", "Muchas gracias.");
  return parts.join("\n");
}

/** Normalize phone/WhatsApp to digits for wa.me (Colombia-friendly). */
export function normalizeWhatsAppDigits(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith("3")) digits = `57${digits}`;
  return digits;
}

export function buildWhatsAppUrl(phone: string, text: string) {
  const digits = normalizeWhatsAppDigits(phone);
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function buildMailtoUrl(input: {
  email: string;
  supplierName: string;
  orderCode: string;
  body: string;
}) {
  const subject = encodeURIComponent(`Pedido ${input.orderCode} — ${input.supplierName}`);
  const body = encodeURIComponent(input.body);
  return `mailto:${input.email}?subject=${subject}&body=${body}`;
}
