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
  data?: {
    x_cod_response?: string;
    x_cod_respuesta?: string;
    x_id_invoice?: string;
    x_transaction_id?: string;
    x_ref_payco?: string;
    ref_payco?: string;
  };
};

function isEpaycoApproved(code: ReturnType<typeof mapEpaycoResponseCode>): boolean {
  return code === "APPROVED";
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
      `https://api.secure.payco.co/validation/v1/reference/${encodeURIComponent(trimmed)}`,
      { cache: "no-store" },
    );
    const payload = (await response.json()) as EpaycoValidationPayload;

    if (!response.ok || payload.success === false || !payload.data) {
      return {
        ok: false,
        approved: false,
        message: "No se pudo validar la transacción en ePayco",
      };
    }

    const responseCode =
      payload.data.x_cod_response ?? payload.data.x_cod_respuesta ?? undefined;
    const approved = isEpaycoApproved(mapEpaycoResponseCode(responseCode));

    return {
      ok: true,
      approved,
      invoiceReference: payload.data.x_id_invoice,
      transactionId: payload.data.x_transaction_id,
      refPayco: payload.data.x_ref_payco ?? payload.data.ref_payco ?? trimmed,
      responseCode,
      message: approved ? "Pago aprobado en ePayco" : "Pago no aprobado en ePayco",
    };
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

    const responseCode = String(
      transaction.x_cod_response ??
        transaction.x_cod_respuesta ??
        transaction.cod_respuesta ??
        "",
    );
    const approved = isEpaycoApproved(mapEpaycoResponseCode(responseCode));

    return {
      ok: true,
      approved,
      invoiceReference:
        typeof transaction.x_id_invoice === "string"
          ? transaction.x_id_invoice
          : typeof transaction.factura === "string"
            ? transaction.factura
            : undefined,
      transactionId:
        typeof transaction.x_transaction_id === "string"
          ? transaction.x_transaction_id
          : typeof transaction.transactionID === "string"
            ? transaction.transactionID
            : undefined,
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
