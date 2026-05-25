import "server-only";

import { PaymentMethodType, PaymentTransactionStatus } from "@prisma/client";
import { resolveWompiConfig } from "@/modules/billing/services/wompi-credentials";
import { assertTenantGuestWompiScope } from "@/lib/payments/tenant-wompi-scope";
import { buildGuestPaymentReference } from "@/lib/payments/guest-payment-reference";

type WompiTransactionPayload = {
  data?: {
    id?: string;
    status?: string;
    reference?: string;
    payment_method_type?: string;
  };
};

const WOMPI_STATUS_MAP: Record<string, PaymentTransactionStatus> = {
  APPROVED: PaymentTransactionStatus.APPROVED,
  APPROVED_PARTIAL: PaymentTransactionStatus.APPROVED,
  DECLINED: PaymentTransactionStatus.DECLINED,
  ERROR: PaymentTransactionStatus.FAILED,
  PENDING: PaymentTransactionStatus.PENDING,
  VOIDED: PaymentTransactionStatus.CANCELLED,
};

export function mapWompiTransactionStatus(
  status: string | undefined,
): PaymentTransactionStatus {
  if (!status) return PaymentTransactionStatus.PENDING;
  return WOMPI_STATUS_MAP[status.toUpperCase()] ?? PaymentTransactionStatus.PENDING;
}

export function mapWompiPaymentMethod(type?: string): PaymentMethodType {
  const n = type?.toUpperCase() ?? "";
  if (n.includes("PSE")) return PaymentMethodType.PSE;
  if (n.includes("NEQUI")) return PaymentMethodType.NEQUI;
  if (n.includes("CARD") || n.includes("CREDIT") || n.includes("DEBIT")) {
    return PaymentMethodType.CARD;
  }
  if (n.includes("TRANSFER")) return PaymentMethodType.TRANSFER;
  return PaymentMethodType.OTHER;
}

export async function fetchWompiTransactionById(input: {
  organizationId: string;
  transactionId: string;
}): Promise<{
  ok: boolean;
  status?: PaymentTransactionStatus;
  reference?: string;
  paymentMethod?: PaymentMethodType;
  message: string;
}> {
  try {
    await assertTenantGuestWompiScope(input.organizationId);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Scope inválido",
    };
  }

  const config = await resolveWompiConfig(input.organizationId);
  if (!config.privateKey || !config.configured) {
    return { ok: false, message: "Wompi no configurado para el tenant" };
  }

  try {
    const response = await fetch(
      `${config.baseUrl}/transactions/${encodeURIComponent(input.transactionId)}`,
      {
        headers: { Authorization: `Bearer ${config.privateKey}` },
        cache: "no-store",
      },
    );

    const payload = (await response.json()) as WompiTransactionPayload;
    if (!response.ok) {
      return {
        ok: false,
        message: `Wompi API ${response.status}`,
      };
    }

    const tx = payload.data;
    return {
      ok: true,
      status: mapWompiTransactionStatus(tx?.status),
      reference: tx?.reference,
      paymentMethod: mapWompiPaymentMethod(tx?.payment_method_type),
      message: "Transacción consultada",
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Error consultando Wompi",
    };
  }
}

export async function fetchWompiTransactionByReference(input: {
  organizationId: string;
  reference: string;
}): Promise<{
  ok: boolean;
  transactionId?: string;
  status?: PaymentTransactionStatus;
  paymentMethod?: PaymentMethodType;
  message: string;
}> {
  try {
    await assertTenantGuestWompiScope(input.organizationId);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Scope inválido",
    };
  }

  const config = await resolveWompiConfig(input.organizationId);
  if (!config.privateKey || !config.configured) {
    return { ok: false, message: "Wompi no configurado" };
  }

  try {
    const url = new URL(`${config.baseUrl}/transactions`);
    url.searchParams.set("reference", input.reference);
    url.searchParams.set("page_size", "5");

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${config.privateKey}` },
      cache: "no-store",
    });

    const payload = (await response.json()) as {
      data?: WompiTransactionPayload["data"][];
    };

    if (!response.ok) {
      return { ok: false, message: `Wompi list ${response.status}` };
    }

    const match =
      payload.data?.find((row) => row?.reference === input.reference) ??
      payload.data?.[0];

    if (!match?.id) {
      return { ok: false, message: "Transacción no encontrada por referencia" };
    }

    return {
      ok: true,
      transactionId: match.id,
      status: mapWompiTransactionStatus(match.status),
      paymentMethod: mapWompiPaymentMethod(match.payment_method_type),
      message: "Transacción encontrada",
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Error listando Wompi",
    };
  }
}

export function guestReferenceForLink(linkId: string): string {
  return buildGuestPaymentReference(linkId);
}
