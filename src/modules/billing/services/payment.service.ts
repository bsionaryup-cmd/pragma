import {
  BillingInvoiceStatus,
  BillingSubscriptionStatus,
  PaymentMethodType,
  PaymentProviderCode,
  PaymentTransactionStatus,
} from "@prisma/client";
import { db } from "@/lib/db";
import {
  hasPaymentLedgerDelegates,
  isPaymentSchemaMissing,
} from "@/modules/billing/lib/billing-schema-guard";
import { createPaymentAttempt } from "@/modules/billing/repositories/payment-attempt.repository";
import {
  ensurePaymentInvoiceForBillingInvoice,
  markPaymentInvoiceFailed,
  markPaymentInvoicePaid,
} from "@/modules/billing/services/invoice.service";
import {
  createTransaction,
  findTransactionByIdempotencyKey,
  findTransactionByProviderReference,
  updateTransactionStatus,
} from "@/modules/billing/repositories/transaction.repository";
import { writePaymentAuditLog } from "@/modules/billing/repositories/audit-log.repository";
import { buildBillingSubscriptionReference } from "@/lib/payments/guest-payment-reference";
import { getPaymentProvider } from "@/modules/billing/providers/provider-registry";
import { resolveSubscriptionPaymentGateway } from "@/modules/billing/services/subscription-payment-gateway.service";
import { resolveOrganizationIdForBillingInvoice } from "@/modules/billing/services/wompi-org";
import {
  isGuestPaymentReference,
  parseBillingSubscriptionReference,
} from "@/lib/payments/guest-payment-reference";
import { reconcileGuestPaymentFromWebhook } from "@/services/payments/guest-payment-reconcile.service";
import { mapEpaycoResponseCode } from "@/modules/integrations/epayco/epayco-signature";
import {
  fetchEpaycoTransactionByRefPayco,
  fetchEpaycoTransactionViaApify,
} from "@/modules/integrations/epayco/epayco-transaction-lookup";
import { resolvePlatformEpaycoConfig } from "@/modules/integrations/epayco/epayco-credentials";
import {
  mapWompiPaymentMethod,
  mapWompiTransactionStatus,
} from "@/services/payments/wompi-transaction-lookup.service";
import { resolvePlatformWompiConfig } from "@/modules/billing/services/wompi-credentials";
import { resolvePlatformWompiOrganizationId } from "@/modules/billing/services/wompi-platform.service";
import { syncBillingAccountAccessAfterPayment } from "@/modules/billing/services/billing-lifecycle.service";
import { requireBillingAccountId } from "@/lib/billing/resolve-billing-account";
import {
  activateSubscriptionFromPaidInvoice,
  findBillingInvoiceByPaymentReference,
} from "@/modules/billing/services/billing-payment-activation.service";
import {
  persistEpaycoRefOnOpenInvoice,
  reconcileOutstandingSubscriptionPayments,
} from "@/modules/billing/services/billing-subscription-reconcile.service";

async function resolvePaymentTenantId(
  billingInvoiceId: string,
): Promise<string> {
  const invoice = await db.billingInvoice.findUnique({
    where: { id: billingInvoiceId },
    select: { billingAccountId: true },
  });
  if (!invoice) return "unknown";

  const billingAccount = await db.billingAccount.findUnique({
    where: { id: invoice.billingAccountId },
    select: { organizationId: true, id: true },
  });

  return billingAccount?.organizationId ?? billingAccount?.id ?? "unknown";
}

export type InitiatePaymentInput = {
  billingInvoiceId: string;
  amountInCents: number;
  currency: string;
  customerEmail: string;
  redirectUrl: string;
  actorId?: string;
};

export async function initiateSubscriptionPayment(input: InitiatePaymentInput) {
  const billingInvoice = await db.billingInvoice.findFirst({
    where: { id: input.billingInvoiceId },
  });

  if (!billingInvoice) {
    return { ok: false as const, message: "Factura no encontrada" };
  }

  const gateway = await resolveSubscriptionPaymentGateway();
  if (!gateway) {
    return {
      ok: false as const,
      message: "Ninguna pasarela configurada (Wompi o ePayco)",
    };
  }

  const reference =
    billingInvoice.externalRef?.startsWith("pragma-")
      ? billingInvoice.externalRef
      : buildBillingSubscriptionReference(input.billingInvoiceId);
  const idempotencyKey = `pay-${input.billingInvoiceId}`;
  const providerCode =
    gateway === "EPAYCO" ? PaymentProviderCode.EPAYCO : PaymentProviderCode.WOMPI;

  let paymentInvoiceId: string | null = null;

  if (hasPaymentLedgerDelegates()) {
    const paymentInvoice = await ensurePaymentInvoiceForBillingInvoice(
      input.billingInvoiceId,
    );
    paymentInvoiceId = paymentInvoice?.id ?? null;

    if (paymentInvoice) {
      const existingTx = await findTransactionByIdempotencyKey(idempotencyKey);
      if (existingTx?.status === PaymentTransactionStatus.APPROVED) {
        return {
          ok: true as const,
          message: "Pago ya confirmado",
          reference: existingTx.providerReference ?? reference,
        };
      }

      const tenantId = await resolvePaymentTenantId(input.billingInvoiceId);
      const transaction =
        existingTx ??
        (await createTransaction({
          tenantId,
          invoice: { connect: { id: paymentInvoice.id } },
          amount: input.amountInCents / 100,
          currency: input.currency,
          provider: providerCode,
          providerReference: reference,
          status: PaymentTransactionStatus.PENDING,
          paymentMethod: PaymentMethodType.OTHER,
          idempotencyKey,
          metadata: { billingInvoiceId: input.billingInvoiceId, gateway },
        }));

      if (!existingTx) {
        await createPaymentAttempt({
          invoiceId: paymentInvoice.id,
          transactionId: transaction.id,
          amount: input.amountInCents / 100,
          currency: input.currency,
          metadata: { reference, gateway },
        });
      }
    }
  }

  if (billingInvoice.externalRef !== reference) {
    await db.billingInvoice.update({
      where: { id: input.billingInvoiceId },
      data: { externalRef: reference },
    });
  }

  const provider = getPaymentProvider(gateway);
  const organizationId =
    (await resolveOrganizationIdForBillingInvoice(input.billingInvoiceId)) ??
    "unknown";

  const checkout = await provider.createCheckout({
    organizationId,
    invoiceId: input.billingInvoiceId,
    paymentInvoiceId: paymentInvoiceId ?? input.billingInvoiceId,
    amountInCents: input.amountInCents,
    currency: input.currency,
    customerEmail: input.customerEmail,
    redirectUrl: input.redirectUrl,
    reference,
  });

  await writePaymentAuditLog({
    entityType: "billing_invoice",
    entityId: input.billingInvoiceId,
    action: checkout.ok ? "checkout_created" : "checkout_failed",
    actorId: input.actorId,
    after: { reference, message: checkout.message },
  });

  return { ...checkout, reference };
}

export async function reconcileTransactionFromWebhook(input: {
  reference: string;
  provider?: PaymentProviderCode;
  providerTransactionId?: string;
  status: PaymentTransactionStatus;
  paymentMethod?: PaymentMethodType;
  failureReason?: string;
}) {
  if (isGuestPaymentReference(input.reference)) {
    return reconcileGuestPaymentFromWebhook(input);
  }

  const provider = input.provider ?? PaymentProviderCode.WOMPI;

  const billingInvoice = await findBillingInvoiceByPaymentReference(input.reference);

  let transaction = hasPaymentLedgerDelegates()
    ? await findTransactionByProviderReference(provider, input.reference)
    : null;

  if (!transaction && billingInvoice && hasPaymentLedgerDelegates()) {
    const paymentInvoice = await ensurePaymentInvoiceForBillingInvoice(
      billingInvoice.id,
    );
    if (paymentInvoice) {
      try {
        const tenantId = await resolvePaymentTenantId(billingInvoice.id);
        await createTransaction({
          tenantId,
          invoice: { connect: { id: paymentInvoice.id } },
          amount: Number(billingInvoice.amount),
          currency: billingInvoice.currency,
          provider,
          providerReference: input.reference,
          status: PaymentTransactionStatus.PENDING,
          idempotencyKey: `wh-${provider}-${input.reference}`,
          metadata: { backfilledFromWebhook: true },
        });
        transaction = await findTransactionByProviderReference(
          provider,
          input.reference,
        );
      } catch (error) {
        if (!isPaymentSchemaMissing(error)) throw error;
      }
    }
  }

  if (!transaction && !billingInvoice) {
    return { ok: true, message: "Referencia desconocida (idempotente)" };
  }

  if (
    transaction &&
    transaction.status === PaymentTransactionStatus.APPROVED &&
    input.status === PaymentTransactionStatus.APPROVED &&
    billingInvoice?.status === BillingInvoiceStatus.PAID
  ) {
    await activateSubscriptionFromPaidInvoice({
      billingInvoiceId: billingInvoice.id,
      providerTransactionId: input.providerTransactionId,
      paymentReference: input.reference,
      provider: input.provider,
    });
    return { ok: true, message: "Transacción ya aprobada (idempotente)" };
  }

  if (transaction) {
    try {
      await updateTransactionStatus(transaction.id, {
        status: input.status,
        providerReference: input.providerTransactionId ?? input.reference,
        paymentMethod: input.paymentMethod,
        metadata: input.failureReason
          ? { failureReason: input.failureReason }
          : undefined,
      });
    } catch (error) {
      if (!isPaymentSchemaMissing(error)) throw error;
    }
  }

  if (!billingInvoice) {
    return { ok: true, message: "Transacción actualizada" };
  }

  const paymentInvoiceId = transaction?.invoiceId;

  if (input.status === PaymentTransactionStatus.APPROVED) {
    await activateSubscriptionFromPaidInvoice({
      billingInvoiceId: billingInvoice.id,
      providerTransactionId: input.providerTransactionId,
      paymentReference: input.reference,
      provider: input.provider,
    });

    if (paymentInvoiceId) {
      try {
        await markPaymentInvoicePaid(paymentInvoiceId);
      } catch (error) {
        if (!isPaymentSchemaMissing(error)) throw error;
      }
    }

    return { ok: true, message: "Pago reconciliado" };
  }

  if (
    input.status === PaymentTransactionStatus.DECLINED ||
    input.status === PaymentTransactionStatus.FAILED
  ) {
    await db.billingInvoice.update({
      where: { id: billingInvoice.id },
      data: {
        status: BillingInvoiceStatus.FAILED,
        failureReason: input.failureReason ?? input.status,
        wompiTransactionId: input.providerTransactionId ?? null,
      },
    });

    if (paymentInvoiceId) {
      try {
        await markPaymentInvoiceFailed(paymentInvoiceId);
      } catch (error) {
        if (!isPaymentSchemaMissing(error)) throw error;
      }
    }

    return { ok: true, message: "Pago fallido registrado" };
  }

  return { ok: true, message: "Evento registrado" };
}

async function fetchPlatformSubscriptionWompiByReference(reference: string): Promise<{
  ok: boolean;
  transactionId?: string;
  status?: PaymentTransactionStatus;
  paymentMethod?: PaymentMethodType;
}> {
  const organizationId = await resolvePlatformWompiOrganizationId();
  if (!organizationId) return { ok: false };

  const config = await resolvePlatformWompiConfig();
  if (!config.privateKey || !config.configured) return { ok: false };

  try {
    const url = new URL(`${config.baseUrl}/transactions`);
    url.searchParams.set("reference", reference);
    url.searchParams.set("page_size", "5");

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${config.privateKey}` },
      cache: "no-store",
    });

    const payload = (await response.json()) as {
      data?: Array<{
        id?: string;
        status?: string;
        reference?: string;
        payment_method_type?: string;
      }>;
    };

    if (!response.ok) return { ok: false };

    const match =
      payload.data?.find((row) => row?.reference === reference) ?? payload.data?.[0];

    if (!match?.id) return { ok: false };

    return {
      ok: true,
      transactionId: match.id,
      status: mapWompiTransactionStatus(match.status),
      paymentMethod: mapWompiPaymentMethod(match.payment_method_type),
    };
  } catch {
    return { ok: false };
  }
}

async function lookupEpaycoTransaction(refPayco: string) {
  let lookup = await fetchEpaycoTransactionByRefPayco(refPayco);
  if (!lookup.ok) {
    const config = await resolvePlatformEpaycoConfig();
    if (config.publicKey && config.privateKey) {
      lookup = await fetchEpaycoTransactionViaApify({
        publicKey: config.publicKey,
        privateKey: config.privateKey,
        env: config.env ?? "test",
        refPayco,
      });
    }
  }
  return lookup;
}

async function reconcileApprovedEpaycoPayment(input: {
  reference: string;
  providerTransactionId?: string;
}): Promise<void> {
  await reconcileTransactionFromWebhook({
    reference: input.reference,
    provider: PaymentProviderCode.EPAYCO,
    providerTransactionId: input.providerTransactionId,
    status: PaymentTransactionStatus.APPROVED,
  });
}

export async function reconcileEpaycoBillingByRefPayco(
  refPayco: string,
  fallbackReference?: string | null,
): Promise<boolean> {
  const lookup = await lookupEpaycoTransaction(refPayco);
  if (!lookup.ok || !lookup.approved) {
    return false;
  }

  const reconcileRef = lookup.invoiceReference ?? fallbackReference ?? null;
  if (!reconcileRef) {
    return false;
  }

  await reconcileApprovedEpaycoPayment({
    reference: reconcileRef,
    providerTransactionId: lookup.transactionId ?? refPayco,
  });
  return true;
}

async function tryReconcileEpaycoReturn(input: {
  reference?: string | null;
  epaycoResponseCode?: string | null;
  epaycoRefPayco?: string | null;
}): Promise<boolean> {
  const refPayco = input.epaycoRefPayco?.trim();
  if (refPayco) {
    const reconciled = await reconcileEpaycoBillingByRefPayco(refPayco, input.reference);
    if (reconciled) return true;
  }

  const reference = input.reference?.trim();
  if (!reference) return false;

  const invoice = await findBillingInvoiceByPaymentReference(reference);
  if (!invoice || invoice.status === BillingInvoiceStatus.PAID) {
    return false;
  }

  const paymentRef = invoice.externalRef ?? reference;
  if (mapEpaycoResponseCode(input.epaycoResponseCode) === "APPROVED") {
    await reconcileApprovedEpaycoPayment({
      reference: paymentRef,
      providerTransactionId: refPayco,
    });
    return true;
  }

  return false;
}

/** Reconcilia pago al volver del checkout si el webhook aún no actualizó la cuenta. */
export async function reconcileBillingPaymentOnReturn(input: {
  reference?: string | null;
  epaycoResponseCode?: string | null;
  epaycoRefPayco?: string | null;
}): Promise<{ ok: boolean; unlocked: boolean }> {
  const billingAccountId = await requireBillingAccountId();
  const reference = input.reference?.trim() || null;
  const epaycoRefPayco = input.epaycoRefPayco?.trim() || null;
  const gateway = await resolveSubscriptionPaymentGateway();

  if (epaycoRefPayco) {
    await persistEpaycoRefOnOpenInvoice({
      billingAccountId,
      refPayco: epaycoRefPayco,
      paymentReference: reference,
    });
  }

  if (gateway === "EPAYCO" && epaycoRefPayco) {
    await tryReconcileEpaycoReturn({
      reference,
      epaycoResponseCode: input.epaycoResponseCode,
      epaycoRefPayco,
    });
  }

  const openInvoice = await db.billingInvoice.findFirst({
    where: {
      billingAccountId,
      status: BillingInvoiceStatus.OPEN,
    },
    orderBy: [{ dueAt: "desc" }, { createdAt: "desc" }],
    select: { id: true, status: true, externalRef: true },
  });

  const paymentRef =
    openInvoice?.externalRef ??
    (openInvoice ? buildBillingSubscriptionReference(openInvoice.id) : null) ??
    reference;

  if (openInvoice && paymentRef) {
    let reconciled = false;

    if (gateway === "EPAYCO") {
      reconciled = await tryReconcileEpaycoReturn({
        reference: paymentRef,
        epaycoResponseCode: input.epaycoResponseCode,
        epaycoRefPayco,
      });
    }

    if (!reconciled) {
      const wompi = await fetchPlatformSubscriptionWompiByReference(paymentRef);
      if (wompi.ok && wompi.status === PaymentTransactionStatus.APPROVED) {
        await reconcileTransactionFromWebhook({
          reference: paymentRef,
          provider: PaymentProviderCode.WOMPI,
          providerTransactionId: wompi.transactionId,
          status: PaymentTransactionStatus.APPROVED,
          paymentMethod: wompi.paymentMethod,
        });
      }
    }
  }

  const account = await db.billingAccount.findUnique({
    where: { id: billingAccountId },
  });
  if (!account) return { ok: false, unlocked: false };

  await reconcileOutstandingSubscriptionPayments(billingAccountId);

  const refreshed = await db.billingAccount.findUnique({
    where: { id: billingAccountId },
  });
  if (!refreshed) return { ok: false, unlocked: false };

  const synced = await syncBillingAccountAccessAfterPayment(refreshed);
  const unlocked =
    synced.status === BillingSubscriptionStatus.ACTIVE && !synced.billingLockedAt;

  return { ok: true, unlocked };
}

export { getPaymentMethodsAvailability } from "@/modules/billing/services/payment-methods.service";
