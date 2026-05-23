import { BillingInvoiceStatus, BillingSubscriptionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { writePaymentAuditLog } from "@/modules/billing/repositories/audit-log.repository";

export async function cancelOrganizationSubscription(input: {
  billingAccountId: string;
  actorId: string;
  reason?: string;
}): Promise<{ ok: boolean; message: string }> {
  const account = await db.billingAccount.findUnique({
    where: { id: input.billingAccountId },
  });

  if (!account) {
    return { ok: false, message: "Cuenta de facturación no encontrada" };
  }

  if (account.status === BillingSubscriptionStatus.CANCELED) {
    return { ok: true, message: "La suscripción ya está cancelada" };
  }

  await db.$transaction([
    db.billingAccount.update({
      where: { id: input.billingAccountId },
      data: {
        status: BillingSubscriptionStatus.CANCELED,
        billingLockedAt: new Date(),
        gracePeriodEndsAt: null,
      },
    }),
    db.billingInvoice.updateMany({
      where: {
        billingAccountId: input.billingAccountId,
        status: { in: [BillingInvoiceStatus.OPEN, BillingInvoiceStatus.DRAFT] },
      },
      data: { status: BillingInvoiceStatus.VOID },
    }),
  ]);

  await writePaymentAuditLog({
    entityType: "billing_account",
    entityId: input.billingAccountId,
    action: "subscription_canceled",
    actorId: input.actorId,
    after: { reason: input.reason ?? "tenant_self_service" },
  });

  return {
    ok: true,
    message:
      "Suscripción cancelada. El acceso quedará restringido al final del período vigente o de inmediato si no hay período activo.",
  };
}
