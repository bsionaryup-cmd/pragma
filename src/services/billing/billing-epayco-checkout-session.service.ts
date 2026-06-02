import "server-only";

import { BillingInvoiceStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { buildBillingSubscriptionReference } from "@/lib/payments/guest-payment-reference";
import type { GuestEpaycoCheckoutSession } from "@/services/payments/guest-epayco-checkout.service";
import {
  isPlatformEpaycoConfigured,
  resolvePlatformEpaycoConfig,
} from "@/modules/integrations/epayco/epayco-credentials";

function resolveAppOrigin(): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    process.env.VERCEL_URL?.trim();
  if (!base) return "http://localhost:3000";
  return base.startsWith("http") ? base.replace(/\/$/, "") : `https://${base}`;
}

export async function getBillingEpaycoCheckoutSession(
  invoiceId: string,
): Promise<{ ok: true; session: GuestEpaycoCheckoutSession } | { ok: false; message: string }> {
  if (!(await isPlatformEpaycoConfigured())) {
    return { ok: false, message: "ePayco no está configurado para suscripciones" };
  }

  const invoice = await db.billingInvoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      amount: true,
      currency: true,
      status: true,
      description: true,
      externalRef: true,
    },
  });

  if (!invoice) return { ok: false, message: "Factura no encontrada" };
  if (
    invoice.status !== BillingInvoiceStatus.OPEN &&
    invoice.status !== BillingInvoiceStatus.FAILED
  ) {
    return { ok: false, message: "Esta factura no está disponible para pago" };
  }

  const config = await resolvePlatformEpaycoConfig();
  if (!config.publicKey) {
    return { ok: false, message: "ePayco no está configurado" };
  }

  const amount = Math.round(Number(invoice.amount));
  if (amount < 1) return { ok: false, message: "Monto inválido" };

  const reference =
    invoice.externalRef?.startsWith("pragma-")
      ? invoice.externalRef
      : buildBillingSubscriptionReference(invoice.id);
  const origin = resolveAppOrigin();

  const session: GuestEpaycoCheckoutSession = {
    publicKey: config.publicKey,
    test: config.test ?? true,
    name: "Suscripción PRAGMA PMS",
    description: invoice.description?.slice(0, 200) ?? `Factura ${invoice.id}`,
    invoice: reference,
    currency: (invoice.currency ?? "COP").toLowerCase(),
    amount: String(amount),
    amountBase: String(amount),
    tax: "0",
    country: "co",
    external: invoice.id,
    response: `${origin}/settings/billing?paid=1&ref=${encodeURIComponent(reference)}`,
    confirmation: `${origin}/api/webhooks/epayco`,
  };

  return { ok: true, session };
}
