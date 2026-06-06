import "server-only";

import { mapEpaycoResponseCode } from "@/modules/integrations/epayco/epayco-signature";
import {
  epaycoApifyLogin,
  extractEpaycoAuthToken,
} from "@/modules/integrations/epayco/epayco-apify.client";
import type { EpaycoEnvironment } from "@/modules/integrations/epayco/epayco.config";
import { resolveEpaycoApifyBaseUrl } from "@/modules/integrations/epayco/epayco.config";

export type EpaycoTransactionLookup = {
  ok: boolean;
  approved: boolean;
  invoiceReference?: string;
  transactionId?: string;
  refPayco?: string;
  responseCode?: string;
  message: string;
};

type EpaycoValidationPayload = {
  success?: boolean;
  status?: boolean;
  data?: Record<string, unknown>;
};

const EPAYCO_VALIDATION_URL = "https://secure.epayco.co/validation/v1/reference";

function isEpaycoApproved(code: ReturnType<typeof mapEpaycoResponseCode>): boolean {
  return code === "APPROVED";
}

function readResponseCode(data: Record<string, unknown>): string | undefined {
  const raw =
    data.x_cod_response ??
    data.x_cod_respuesta ??
    data.cod_respuesta ??
    data.cod_response;
  return raw == null ? undefined : String(raw);
}

function readInvoiceReference(data: Record<string, unknown>): string | undefined {
  const raw = data.x_id_invoice ?? data.factura ?? data.id_invoice;
  return typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
}

function readTransactionId(data: Record<string, unknown>): string | undefined {
  const raw = data.x_transaction_id ?? data.transactionID ?? data.transaction_id;
  return typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
}

function parseValidationPayload(payload: EpaycoValidationPayload): EpaycoTransactionLookup {
  const data = payload.data;
  if (!data || typeof data !== "object") {
    return {
      ok: false,
      approved: false,
      message: "No se pudo validar la transacción en ePayco",
    };
  }

  if (data.status === "error") {
    return {
      ok: false,
      approved: false,
      message:
        typeof data.description === "string"
          ? data.description
          : "No se pudo validar la transacción en ePayco",
    };
  }

  const responseCode = readResponseCode(data);
  const approved = isEpaycoApproved(mapEpaycoResponseCode(responseCode));

  return {
    ok: true,
    approved,
    invoiceReference: readInvoiceReference(data),
    transactionId: readTransactionId(data),
    refPayco:
      typeof data.x_ref_payco === "string"
        ? data.x_ref_payco
        : typeof data.ref_payco === "string"
          ? data.ref_payco
          : undefined,
    responseCode,
    message: approved ? "Pago aprobado en ePayco" : "Pago no aprobado en ePayco",
  };
}

export async function fetchEpaycoTransactionByRefPayco(
  refPayco: string,
): Promise<EpaycoTransactionLookup> {
  const trimmed = refPayco.trim();
  if (!trimmed) {
    return { ok: false, approved: false, message: "ref_payco vacío" };
  }

  try {
    const response = await fetch(
      `${EPAYCO_VALIDATION_URL}/${encodeURIComponent(trimmed)}`,
      { cache: "no-store" },
    );
    const payload = (await response.json()) as EpaycoValidationPayload;

    if (!response.ok) {
      return {
        ok: false,
        approved: false,
        message: "No se pudo validar la transacción en ePayco",
      };
    }

    if (payload.success === false || payload.status === false) {
      return {
        ok: false,
        approved: false,
        message: "No se pudo validar la transacción en ePayco",
      };
    }

    return parseValidationPayload(payload);
  } catch (error) {
    return {
      ok: false,
      approved: false,
      message:
        error instanceof Error ? error.message : "Error consultando ePayco",
    };
  }
}

export async function fetchEpaycoTransactionViaApify(input: {
  publicKey: string;
  privateKey: string;
  env: EpaycoEnvironment;
  refPayco: string;
}): Promise<EpaycoTransactionLookup> {
  const login = await epaycoApifyLogin({
    publicKey: input.publicKey,
    privateKey: input.privateKey,
    env: input.env,
  });

  if (!login.ok || !login.token) {
    return { ok: false, approved: false, message: login.message };
  }

  const baseUrl = resolveEpaycoApifyBaseUrl(input.env);

  try {
    const response = await fetch(`${baseUrl}/payment/transaction`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${login.token}`,
      },
      body: JSON.stringify({ referencePayco: input.refPayco.trim() }),
      cache: "no-store",
    });

    const payload = (await response.json()) as Record<string, unknown>;
    const token = extractEpaycoAuthToken(payload);
    if (token) {
      return { ok: false, approved: false, message: "Respuesta inesperada de ePayco" };
    }

    const data =
      payload.data && typeof payload.data === "object"
        ? (payload.data as Record<string, unknown>)
        : payload;

    const transaction =
      data.transaction && typeof data.transaction === "object"
        ? (data.transaction as Record<string, unknown>)
        : data;

    const responseCode = readResponseCode(transaction);
    const approved = isEpaycoApproved(mapEpaycoResponseCode(responseCode));

    return {
      ok: true,
      approved,
      invoiceReference: readInvoiceReference(transaction),
      transactionId: readTransactionId(transaction),
      refPayco: input.refPayco.trim(),
      responseCode,
      message: approved ? "Pago aprobado en ePayco" : "Pago no aprobado en ePayco",
    };
  } catch (error) {
    return {
      ok: false,
      approved: false,
      message:
        error instanceof Error ? error.message : "Error consultando ePayco Apify",
    };
  }
}
