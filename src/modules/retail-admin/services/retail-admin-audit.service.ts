import "server-only";

import type { Prisma, User } from "@prisma/client";
import { db } from "@/lib/db";
import { writePlatformAuditLog } from "@/services/platform/platform-audit.service";

export async function listRetailAuditLogs(options: {
  storeId?: string;
  limit?: number;
}) {
  return db.retailAuditLog.findMany({
    where: options.storeId ? { storeId: options.storeId } : undefined,
    include: { store: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(options.limit ?? 100, 1), 200),
  });
}

export async function writeRetailAdminPlatformAudit(input: {
  platformUser: Pick<User, "id" | "email">;
  action: string;
  organizationId?: string | null;
  targetUserId?: string | null;
  previousState?: Prisma.InputJsonValue;
  newState?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
}) {
  await writePlatformAuditLog({
    platformUserId: input.platformUser.id,
    ownerEmail: input.platformUser.email,
    action: input.action,
    targetTenantId: input.organizationId,
    targetUserId: input.targetUserId,
    previousState: input.previousState,
    newState: input.newState,
    metadata: { product: "INTIENDAS", ...((input.metadata ?? {}) as object) },
  });
}
