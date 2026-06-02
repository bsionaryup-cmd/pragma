import "server-only";

import { PaymentMethodType, PaymentTransactionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import {
  parseBillingSubscriptionReference,
  parseGuestPaymentReference,
} from "@/lib/payments/guest-payment-reference";
import {
  mapEpaycoResponseCode,
  verifyEpaycoConfirmationSignature,
} from "@/modules/integrations/epayco/epayco-signature";
import {
  resolveEpaycoConfig,
  resolvePlatformEpaycoConfig,
} from "@/modules/integrations/epayco/epayco-credentials";
import { reconcileTransactionFromWebhook } from "@/modules/billing/services/payment.service";
import { reconcileGuestPaymentFromProvider } from "@/services/payments/guest-payment-reconcile.service";
import type { EpaycoRuntimeConfig } from "@/modules/integrations/epayco/epayco-credentials";

export type EpaycoConfirmationPayload = Record<string, string>;

function readField(
  payload: EpaycoConfirmationPayload,
  keys: string[],
): string {
  for (const key of keys) {
    const value = payload[key];
    if (value?.trim()) return value.trim();
  }
  return "";
}

function mapEpaycoToTransactionStatus(
  code: ReturnType<typeof mapEpaycoResponseCode>,
): PaymentTransactionStatus {
  switch (code) {
    case "APPROVED":
      return PaymentTransactionStatus.APPROVED;
    case "PENDING":
      return PaymentTransactionStatus.PENDING;
    case "FAILED":
      return PaymentTransactionStatus.FAILED;
    default:
      return PaymentTransactionStatus.PENDING;
  }
}

function mapEpaycoPaymentMethod(franchise: string): PaymentMethodType {
  const value = franchise.trim().toUpperCase();
  if (value.includes("PSE")) return PaymentMethodType.PSE;
  if (value.includes("NEQUI")) return PaymentMethodType.NEQUI;
  if (value.includes("BANCOLOMBIA") || value.includes("BANCO")) {
    return PaymentMethodType.TRANSFER;
  }
  return PaymentMethodType.CARD;
}

function verifyPayloadSignature(
  payload: EpaycoConfirmationPayload,
  config: Partial<EpaycoRuntimeConfig>,
): boolean {
  if (!config.pKey) return false;

  const refPayco = readField(payload, ["x_ref_payco", "ref_payco"]);
  const transactionId = readField(payload, ["x_transaction_id", "x_id_factura"]);
  const amount = readField(payload, ["x_amount", "x_amount_ok"]);
  const currencyCode = readField(payload, ["x_currency_code", "x_currency"]);
  const signature = readField(payload, ["x_signature", "x_sign"]);

  return verifyEpaycoConfirmationSignature({
    custIdCliente: config.custIdCliente || config.publicKey || "",
    refPayco,
    transactionId,
    amount,
    currencyCode,
    pKey: config.pKey,
    signature,
  });
}

function readTransactionStatus(payload: EpaycoConfirmationPayload): PaymentTransactionStatus {
  const responseCode = mapEpaycoResponseCode(
    readField(payload, ["x_cod_response", "x_cod_respuesta"]),
  );
  return mapEpaycoToTransactionStatus(responseCode);
}

export async function processEpaycoConfirmationWebhook(
  payload: EpaycoConfirmationPayload,
): Promise<{ ok: boolean; message: string; status: number }> {
  const invoice = readField(payload, ["x_id_invoice", "x_invoice", "id_invoice"]);
  const guestLinkId = parseGuestPaymentReference(invoice);
  if (guestLinkId) {
    return processGuestEpaycoConfirmation(payload, invoice, guestLinkId);
  }

  const billingInvoiceId = parseBillingSubscriptionReference(invoice);
  if (billingInvoiceId) {
    return processBillingEpaycoConfirmation(payload, invoice);
  }

  return { ok: true, message: "Confirmación ignorada (referencia desconocida)", status: 200 };
}

async function processGuestEpaycoConfirmation(
  payload: EpaycoConfirmationPayload,
  invoice: string,
  linkId: string,
): Promise<{ ok: boolean; message: string; status: number }> {
  const link = await db.guestPaymentLink.findUnique({
    where: { id: linkId },
    select: { id: true, organizationId: true },
  });

  if (!link) {
    return { ok: true, message: "Link desconocido (idempotente)", status: 200 };
  }

  const config = await resolveEpaycoConfig(link.organizationId);
  if (!config.pKey) {
    return { ok: false, message: "ePayco no configurado para el tenant", status: 500 };
  }

  if (!verifyPayloadSignature(payload, config)) {
    return { ok: false, message: "Firma ePayco inválida", status: 401 };
  }

  const refPayco = readField(payload, ["x_ref_payco", "ref_payco"]);
  const transactionId = readField(payload, ["x_transaction_id", "x_id_factura"]);
  const txStatus = readTransactionStatus(payload);

  await db.guestPaymentLink.updateMany({
    where: { id: link.id },
    data: {
      epaycoRefPayco: refPayco || undefined,
      paymentGateway: "EPAYCO",
    },
  });

  const reconcile = await reconcileGuestPaymentFromProvider({
    reference: invoice,
    provider: "EPAYCO",
    providerTransactionId: transactionId || refPayco || undefined,
    status: txStatus,
    paymentMethod: mapEpaycoPaymentMethod(
      readField(payload, ["x_franchise", "x_bank_name"]),
    ),
    failureReason:
      txStatus === PaymentTransactionStatus.FAILED
        ? readField(payload, ["x_response", "x_response_reason_text"])
        : undefined,
  });

  return {
    ok: reconcile.ok,
    message: reconcile.message,
    status: reconcile.ok ? 200 : 500,
  };
}

async function processBillingEpaycoConfirmation(
  payload: EpaycoConfirmationPayload,
  invoice: string,
): Promise<{ ok: boolean; message: string; status: number }> {
  const config = await resolvePlatformEpaycoConfig();
  if (!config.pKey) {
    return { ok: false, message: "ePayco no configurado para suscripciones", status: 500 };
  }

  if (!verifyPayloadSignature(payload, config)) {
    return { ok: false, message: "Firma ePayco inválida", status: 401 };
  }

  const refPayco = readField(payload, ["x_ref_payco", "ref_payco"]);
  const transactionId = readField(payload, ["x_transaction_id", "x_id_factura"]);
  const txStatus = readTransactionStatus(payload);

  const reconcile = await reconcileTransactionFromWebhook({
    reference: invoice,
    provider: "EPAYCO",
    providerTransactionId: transactionId || refPayco || undefined,
    status: txStatus,
    paymentMethod: mapEpaycoPaymentMethod(
      readField(payload, ["x_franchise", "x_bank_name"]),
    ),
    failureReason:
      txStatus === PaymentTransactionStatus.FAILED
        ? readField(payload, ["x_response", "x_response_reason_text"])
        : undefined,
  });

  return {
    ok: reconcile.ok,
    message: reconcile.message,
    status: reconcile.ok ? 200 : 500,
  };
}
