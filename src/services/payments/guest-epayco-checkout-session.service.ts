import "server-only";

import { db } from "@/lib/db";
import { buildGuestPaymentReference } from "@/lib/payments/guest-payment-reference";
import type { GuestEpaycoCheckoutSession } from "@/services/payments/guest-epayco-checkout.service";
import { resolveEpaycoConfig } from "@/modules/integrations/epayco/epayco-credentials";

function resolveAppOrigin(): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    process.env.VERCEL_URL?.trim();
  if (!base) return "http://localhost:3000";
  return base.startsWith("http") ? base.replace(/\/$/, "") : `https://${base}`;
}

export async function getGuestEpaycoCheckoutSession(
  linkId: string,
): Promise<{ ok: true; session: GuestEpaycoCheckoutSession } | { ok: false; message: string }> {
  const link = await db.guestPaymentLink.findUnique({
    where: { id: linkId },
    select: {
      id: true,
      organizationId: true,
      description: true,
      amount: true,
      currency: true,
      status: true,
      guestName: true,
      expiresAt: true,
      reservation: { select: { guestEmail: true } },
    },
  });

  if (!link) return { ok: false, message: "Enlace de pago no encontrado" };
  if (link.status === "PAID") return { ok: false, message: "Este enlace ya fue pagado" };
  if (link.status === "CANCELLED") {
    return { ok: false, message: "Este enlace fue cancelado" };
  }
  if (link.expiresAt && link.expiresAt < new Date()) {
    return { ok: false, message: "Este enlace está vencido" };
  }

  const config = await resolveEpaycoConfig(link.organizationId);
  if (!config.publicKey) {
    return { ok: false, message: "ePayco no está configurado" };
  }

  const amount = Math.round(Number(link.amount));
  if (amount < 1) return { ok: false, message: "Monto inválido" };

  const invoice = buildGuestPaymentReference(link.id);
  const origin = resolveAppOrigin();

  const session: GuestEpaycoCheckoutSession = {
    publicKey: config.publicKey,
    test: config.test ?? true,
    name: link.description.slice(0, 80),
    description: link.description.slice(0, 200),
    invoice,
    currency: link.currency.toLowerCase(),
    amount: String(amount),
    amountBase: String(amount),
    tax: "0",
    country: "co",
    external: link.id,
    response: `${origin}/finance/payment-links?status=paid&ref=${encodeURIComponent(invoice)}`,
    confirmation: `${origin}/api/webhooks/epayco`,
    emailBilling: link.reservation?.guestEmail ?? undefined,
    nameBilling: link.guestName ?? undefined,
  };

  return { ok: true, session };
}
