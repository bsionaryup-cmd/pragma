import { db } from "@/lib/db";

/** Resolves tenant organization from Wompi payment reference (`pragma-{invoiceId}`). */
export async function resolveOrganizationIdFromPaymentReference(
  reference: string,
): Promise<string | null> {
  const trimmed = reference.trim();
  if (!trimmed) return null;

  const invoiceId = trimmed.startsWith("pragma-")
    ? trimmed.slice("pragma-".length)
    : null;

  const invoice = await db.billingInvoice.findFirst({
    where: invoiceId
      ? { OR: [{ externalRef: trimmed }, { id: invoiceId }] }
      : { externalRef: trimmed },
    select: {
      account: {
        select: { organizationId: true },
      },
    },
  });

  return invoice?.account?.organizationId ?? null;
}

export async function resolveOrganizationIdForBillingInvoice(
  billingInvoiceId: string,
): Promise<string | null> {
  const invoice = await db.billingInvoice.findUnique({
    where: { id: billingInvoiceId },
    select: {
      account: {
        select: { organizationId: true },
      },
    },
  });

  return invoice?.account?.organizationId ?? null;
}
