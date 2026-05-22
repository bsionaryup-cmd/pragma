import { db } from "@/lib/db";
import { TENANT_SINGLETON } from "@/modules/billing/domain/constants";
import {
  hasPaymentLedgerDelegates,
  isPaymentSchemaMissing,
} from "@/modules/billing/lib/billing-schema-guard";

export async function writePaymentAuditLog(input: {
  entityType: string;
  entityId: string;
  action: string;
  actorId?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
}) {
  if (!hasPaymentLedgerDelegates()) return;
  try {
    await db.paymentAuditLog.create({
      data: {
        tenantId: TENANT_SINGLETON,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        actorId: input.actorId ?? null,
        before: input.before ? (input.before as object) : undefined,
        after: input.after ? (input.after as object) : undefined,
        metadata: input.metadata ? (input.metadata as object) : undefined,
      },
    });
  } catch (error) {
    if (!isPaymentSchemaMissing(error)) {
      console.error("[billing] audit log error:", error);
    }
  }
}
