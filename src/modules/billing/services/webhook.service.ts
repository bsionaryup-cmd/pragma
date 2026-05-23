import { createHash } from "crypto";
import { PaymentProviderCode, PaymentTransactionStatus } from "@prisma/client";
import {
  resolvePlatformWompiConfig,
} from "@/modules/billing/services/wompi-credentials";
import { resolvePlatformWompiOrganizationId } from "@/modules/billing/services/wompi-platform.service";
import { wompiAdapter } from "@/modules/billing/providers/wompi/wompi.adapter";
import {
  createWebhookLog,
  findWebhookLog,
  markWebhookProcessed,
} from "@/modules/billing/repositories/webhook-log.repository";
import { reconcileTransactionFromWebhook } from "@/modules/billing/services/payment.service";
import { parseWompiWebhookPayload } from "@/modules/billing/validation/webhook.schema";
import {
  hasPaymentLedgerDelegates,
  isPaymentSchemaMissing,
  PAYMENT_LEDGER_HINT,
} from "@/modules/billing/lib/billing-schema-guard";

const WEBHOOK_RATE_WINDOW_MS = 60_000;
const WEBHOOK_RATE_MAX = 120;
const rateBucket = new Map<string, { count: number; resetAt: number }>();

function checkWebhookRateLimit(ip: string): void {
  const now = Date.now();
  const bucket = rateBucket.get(ip);
  if (!bucket || bucket.resetAt < now) {
    rateBucket.set(ip, { count: 1, resetAt: now + WEBHOOK_RATE_WINDOW_MS });
    return;
  }
  bucket.count += 1;
  if (bucket.count > WEBHOOK_RATE_MAX) {
    throw new Error("Rate limit excedido");
  }
}

function buildEventId(
  event: { event?: string; data?: { transaction?: { id?: string; reference?: string } } },
  rawBody: string,
): string {
  const txId = event.data?.transaction?.id;
  const reference = event.data?.transaction?.reference;
  const eventName = event.event ?? "unknown";
  if (txId) return `${eventName}:${txId}`;
  if (reference) return `${eventName}:${reference}`;
  return createHash("sha256").update(rawBody).digest("hex").slice(0, 32);
}

async function resolveWebhookVerificationConfig(_input: {
  rawBody: string;
}): Promise<{ eventsSecret: string | null; organizationId: string | null }> {
  const platformOrgId = await resolvePlatformWompiOrganizationId();
  const config = await resolvePlatformWompiConfig();

  if (config.eventsSecret) {
    return { eventsSecret: config.eventsSecret, organizationId: platformOrgId };
  }

  return { eventsSecret: null, organizationId: null };
}

export async function processWompiWebhook(input: {
  rawBody: string;
  signature: string | null;
  clientIp?: string;
}): Promise<{ ok: boolean; message: string; status: number }> {
  if (input.clientIp) {
    try {
      checkWebhookRateLimit(input.clientIp);
    } catch {
      return { ok: false, message: "Rate limit excedido", status: 429 };
    }
  }

  if (!input.signature) {
    return { ok: false, message: "Firma ausente", status: 401 };
  }

  const verification = await resolveWebhookVerificationConfig({
    rawBody: input.rawBody,
  });

  if (!verification.eventsSecret) {
    return {
      ok: false,
      message: "Secreto de eventos Wompi no configurado",
      status: 503,
    };
  }

  const provider = wompiAdapter;
  const signatureValid = await wompiAdapter.verifyWebhookSignatureAsync({
    rawBody: input.rawBody,
    signature: input.signature,
    organizationId: verification.organizationId ?? undefined,
    eventsSecret: verification.eventsSecret,
  });

  if (!signatureValid) {
    if (hasPaymentLedgerDelegates()) {
      await createWebhookLog({
        eventType: "unknown",
        eventId: createHash("sha256").update(input.rawBody).digest("hex").slice(0, 16),
        signatureValid: false,
        payload: { error: "invalid_signature" },
        errorMessage: "Firma inválida",
      });
    }
    return { ok: false, message: "Firma inválida", status: 401 };
  }

  const event = parseWompiWebhookPayload(input.rawBody);
  if (!event) {
    return { ok: false, message: "JSON inválido", status: 400 };
  }

  const eventId = buildEventId(event, input.rawBody);
  const existing = hasPaymentLedgerDelegates()
    ? await findWebhookLog(PaymentProviderCode.WOMPI, eventId)
    : null;

  if (existing?.processed) {
    if (hasPaymentLedgerDelegates()) {
      await createWebhookLog({
        eventType: event.event,
        eventId: `${eventId}:replay`,
        signatureValid: true,
        payload: event,
        duplicate: true,
        processed: true,
        errorMessage: "Replay ignorado",
      });
    }
    return { ok: true, message: "Evento duplicado (idempotente)", status: 200 };
  }

  const log = hasPaymentLedgerDelegates()
    ? await createWebhookLog({
        eventType: event.event,
        eventId,
        signatureValid: true,
        payload: event,
        duplicate: Boolean(existing),
      })
    : null;

  const reference = event.data?.transaction?.reference;
  if (!reference) {
    if (log) await markWebhookProcessed(log.id, "Sin referencia");
    return { ok: false, message: "Evento sin referencia", status: 422 };
  }

  const wompiStatus = event.data?.transaction?.status ?? "";
  const mappedStatus =
    provider.mapProviderStatus?.(wompiStatus) ?? PaymentTransactionStatus.PENDING;
  const paymentMethod = provider.mapPaymentMethodType?.(
    event.data?.transaction?.payment_method_type,
  );

  try {
    const result = await reconcileTransactionFromWebhook({
      reference,
      providerTransactionId: event.data?.transaction?.id,
      status: mappedStatus,
      paymentMethod,
      failureReason:
        mappedStatus === PaymentTransactionStatus.DECLINED ||
        mappedStatus === PaymentTransactionStatus.FAILED
          ? wompiStatus
          : undefined,
    });

    if (log) await markWebhookProcessed(log.id);
    return { ok: result.ok, message: result.message, status: result.ok ? 200 : 422 };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error de procesamiento";
    if (log) await markWebhookProcessed(log.id, message);
    if (isPaymentSchemaMissing(error)) {
      return { ok: false, message: PAYMENT_LEDGER_HINT, status: 503 };
    }
    return { ok: false, message, status: 500 };
  }
}
