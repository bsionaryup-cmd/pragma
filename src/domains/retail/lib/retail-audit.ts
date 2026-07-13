import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

type RetailAuditInput = {
  storeId: string;
  action: string;
  entityType: string;
  entityId?: string;
  actorUserId?: string;
  metadata?: Prisma.InputJsonValue;
};

export function writeRetailAuditLog(input: RetailAuditInput) {
  return db.retailAuditLog.create({
    data: {
      storeId: input.storeId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      actorUserId: input.actorUserId,
      metadata: input.metadata,
    },
  });
}
