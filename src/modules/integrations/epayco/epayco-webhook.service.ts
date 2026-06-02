import "server-only";

import { PaymentMethodType, PaymentTransactionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { parseGuestPaymentReference } from "@/lib/payments/guest-payment-reference";
import {
  mapEpaycoResponseCode,
  verifyEpaycoConfirmationSignature,
} from "@/modules/integrations/epayco/epayco-signature";
import { resolveEpaycoConfig } from "@/modules/integrations/epayco/epayco-credentials";
import { reconcileGuestPaymentFromProvider } from "@/services/payments/guest-payment-reconcile.service";

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

export async function processEpaycoConfirmationWebhook(
  payload: EpaycoConfirmationPayload,
): Promise<{ ok: boolean; message: string; status: number }> {
  const invoice = readField(payload, ["x_id_invoice", "x_invoice", "id_invoice"]);
  const linkId = parseGuestPaymentReference(invoice);
  if (!linkId) {
    return { ok: true, message: "Confirmación ignorada (no es guest payment)", status: 200 };
  }

  const link = await db.guestPaymentLink.findUnique({
    where: { id: linkId },
    select: { id: true, organizationId: true },
  });

  if (!link) {
    return { ok: true, message: "Link desconocido (idempotente)", status: 200 };
  }

  const config = await resolveEpaycoConfig(link.organizationId);
  if (!config.pKey || !config.custIdCliente) {
    return { ok: false, message: "ePayco no configurado para el tenant", status: 500 };
  }

  const refPayco = readField(payload, ["x_ref_payco", "ref_payco"]);
  const transactionId = readField(payload, ["x_transaction_id", "x_id_factura"]);
  const amount = readField(payload, ["x_amount", "x_amount_ok"]);
  const currencyCode = readField(payload, ["x_currency_code", "x_currency"]);
  const signature = readField(payload, ["x_signature", "x_sign"]);

  if (
    !verifyEpaycoConfirmationSignature({
      custIdCliente: config.custIdCliente || config.publicKey || "",
      refPayco,
      transactionId,
      amount,
      currencyCode,
      pKey: config.pKey,
      signature,
    })
  ) {
    return { ok: false, message: "Firma ePayco inválida", status: 401 };
  }

  const responseCode = mapEpaycoResponseCode(
    readField(payload, ["x_cod_response", "x_cod_respuesta"]),
  );
  const txStatus = mapEpaycoToTransactionStatus(responseCode);

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
