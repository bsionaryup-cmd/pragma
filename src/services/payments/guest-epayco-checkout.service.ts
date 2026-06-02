import "server-only";

import { buildGuestPaymentReference } from "@/lib/payments/guest-payment-reference";
import { assertTenantEpaycoScope } from "@/lib/payments/tenant-epayco-scope";
import { isEpaycoConfiguredForOrganization } from "@/modules/integrations/epayco/epayco-credentials";

function resolveAppOrigin(): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    process.env.VERCEL_URL?.trim();
  if (!base) return "http://localhost:3000";
  return base.startsWith("http") ? base.replace(/\/$/, "") : `https://${base}`;
}

export type GuestEpaycoCheckoutSession = {
  publicKey: string;
  test: boolean;
  name: string;
  description: string;
  invoice: string;
  currency: string;
  amount: string;
  amountBase: string;
  tax: string;
  country: string;
  external: string;
  response: string;
  confirmation: string;
  emailBilling?: string;
  nameBilling?: string;
};

export async function createGuestEpaycoCheckout(input: {
  organizationId: string;
  linkId: string;
  description: string;
  amount: number;
  currency: string;
  customerEmail?: string | null;
  customerName?: string | null;
}): Promise<{
  ok: boolean;
  message: string;
  checkoutUrl?: string;
  invoice?: string;
}> {
  await assertTenantEpaycoScope(input.organizationId);

  const configured = await isEpaycoConfiguredForOrganization(input.organizationId);
  if (!configured) {
    return {
      ok: false,
      message:
        "Conecta ePayco en Integraciones → ePayco antes de generar enlaces de pago.",
    };
  }

  if (input.amount <= 0) {
    return { ok: false, message: "Monto inválido para ePayco" };
  }

  const invoice = buildGuestPaymentReference(input.linkId);
  const checkoutUrl = `${resolveAppOrigin()}/pay/epayco/${encodeURIComponent(input.linkId)}`;

  return {
    ok: true,
    message: "Checkout ePayco listo",
    checkoutUrl,
    invoice,
  };
}

export function buildGuestEpaycoCheckoutPath(linkId: string): string {
  return `/pay/epayco/${encodeURIComponent(linkId)}`;
}
