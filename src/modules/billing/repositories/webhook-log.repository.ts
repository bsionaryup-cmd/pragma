import { PaymentProviderCode } from "@prisma/client";
import { db } from "@/lib/db";
import { TENANT_SINGLETON } from "@/modules/billing/domain/constants";
import {
  hasPaymentLedgerDelegates,
  isPaymentSchemaMissing,
} from "@/modules/billing/lib/billing-schema-guard";

export async function findWebhookLog(
  provider: PaymentProviderCode,
  eventId: string,
) {
  if (!hasPaymentLedgerDelegates()) return null;
  try {
    return await db.paymentWebhookLog.findUnique({
      where: { provider_eventId: { provider, eventId } },
    });
  } catch (error) {
    if (isPaymentSchemaMissing(error)) return null;
    throw error;
  }
}

export async function createWebhookLog(input: {
  provider?: PaymentProviderCode;
  eventType: string;
  eventId: string;
  signatureValid: boolean;
  payload: unknown;
  duplicate?: boolean;
  processed?: boolean;
  errorMessage?: string;
}) {
  if (!hasPaymentLedgerDelegates()) return null;
  try {
    return await db.paymentWebhookLog.create({
      data: {
        tenantId: TENANT_SINGLETON,
        provider: input.provider ?? PaymentProviderCode.WOMPI,
        eventType: input.eventType,
        eventId: input.eventId,
        signatureValid: input.signatureValid,
        duplicate: input.duplicate ?? false,
        processed: input.processed ?? false,
        payload: input.payload as object,
        errorMessage: input.errorMessage ?? null,
      },
    });
  } catch (error) {
    if (isPaymentSchemaMissing(error)) return null;
    throw error;
  }
}

export async function markWebhookProcessed(id: string, errorMessage?: string) {
  if (!hasPaymentLedgerDelegates()) return;
  try {
    await db.paymentWebhookLog.update({
      where: { id },
      data: { processed: true, errorMessage: errorMessage ?? null },
    });
  } catch (error) {
    if (!isPaymentSchemaMissing(error)) throw error;
  }
}
