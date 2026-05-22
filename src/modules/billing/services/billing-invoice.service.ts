import { BillingInvoiceStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireBillingAccountId } from "@/lib/billing/resolve-billing-account";
import { ensurePaymentInvoiceForBillingInvoice } from "@/modules/billing/services/invoice.service";

/** Factura lista para iniciar checkout Wompi (OPEN o reabierta desde FAILED). */
export async function prepareBillingInvoiceForPayment(invoiceId: string) {
  const billingAccountId = await requireBillingAccountId();
  const invoice = await db.billingInvoice.findFirst({
    where: {
      id: invoiceId,
      billingAccountId,
    },
  });

  if (!invoice) return null;

  if (invoice.status === BillingInvoiceStatus.OPEN) {
    return invoice;
  }

  if (invoice.status === BillingInvoiceStatus.FAILED) {
    const reopened = await db.billingInvoice.update({
      where: { id: invoiceId },
      data: {
        status: BillingInvoiceStatus.OPEN,
        failureReason: null,
      },
    });
    void ensurePaymentInvoiceForBillingInvoice(invoiceId).catch((err) => {
      console.error("[billing] payment invoice sync on retry:", err);
    });
    return reopened;
  }

  return null;
}
