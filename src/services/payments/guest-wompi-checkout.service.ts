import "server-only";

import {
  isWompiConfiguredForOrganization,
  resolveWompiConfig,
} from "@/modules/billing/services/wompi-credentials";
import { assertTenantGuestWompiScope } from "@/lib/payments/tenant-wompi-scope";
import { buildGuestPaymentReference } from "@/lib/payments/guest-payment-reference";

function resolveAppOrigin(): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    process.env.VERCEL_URL?.trim();
  if (!base) return "http://localhost:3000";
  return base.startsWith("http") ? base.replace(/\/$/, "") : `https://${base}`;
}

export async function createGuestWompiCheckout(input: {
  organizationId: string;
  linkId: string;
  description: string;
  amount: number;
  currency: string;
  customerEmail?: string | null;
}): Promise<{ ok: boolean; message: string; checkoutUrl?: string; wompiLinkId?: string }> {
  await assertTenantGuestWompiScope(input.organizationId);

  const configured = await isWompiConfiguredForOrganization(input.organizationId);
  if (!configured) {
    return {
      ok: false,
      message:
        "Conecta la cuenta Wompi del tenant en Integraciones → Wompi antes de generar enlaces.",
    };
  }

  const config = await resolveWompiConfig(input.organizationId);
  if (!config.privateKey || !config.baseUrl) {
    return { ok: false, message: "Credenciales Wompi incompletas" };
  }

  const amountInCents = Math.round(input.amount * 100);
  if (amountInCents < 1) {
    return { ok: false, message: "Monto inválido para Wompi" };
  }

  const reference = buildGuestPaymentReference(input.linkId);
  const redirectUrl = `${resolveAppOrigin()}/finance/payment-links?status=paid&ref=${encodeURIComponent(reference)}`;

  try {
    const response = await fetch(`${config.baseUrl}/payment_links`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.privateKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: input.description.slice(0, 80),
        description: input.description.slice(0, 200),
        single_use: true,
        collect_shipping: false,
        currency: input.currency,
        amount_in_cents: amountInCents,
        reference,
        redirect_url: redirectUrl,
        customer_data: input.customerEmail
          ? { email: input.customerEmail }
          : undefined,
      }),
    });

    const payload = (await response.json()) as {
      data?: { id?: string; permalink?: string };
      error?: { reason?: string };
    };

    if (!response.ok) {
      return {
        ok: false,
        message: payload.error?.reason ?? "Wompi rechazó el enlace de pago",
      };
    }

    const checkoutUrl =
      payload.data?.permalink ??
      (payload.data?.id ? `https://checkout.wompi.co/l/${payload.data.id}` : undefined);

    if (!checkoutUrl) {
      return { ok: false, message: "Wompi no devolvió URL de checkout" };
    }

    return {
      ok: true,
      message: "Enlace generado",
      checkoutUrl,
      wompiLinkId: payload.data?.id ?? undefined,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Error al contactar Wompi",
    };
  }
}
