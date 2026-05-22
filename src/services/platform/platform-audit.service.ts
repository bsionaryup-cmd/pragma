import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type PlatformAuditInput = {
  platformUserId: string;
  ownerEmail: string;
  action: string;
  targetTenantId?: string | null;
  targetUserId?: string | null;
  previousState?: Prisma.InputJsonValue;
  newState?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
};

export async function getRequestAuditMeta(): Promise<{
  ipAddress: string | null;
  userAgent: string | null;
  deviceLabel: string | null;
}> {
  const headerStore = await headers();
  const forwarded = headerStore.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    headerStore.get("x-real-ip") ||
    null;
  const userAgent = headerStore.get("user-agent");
  const deviceLabel = userAgent?.includes("Mobile") ? "Mobile" : "Desktop";
  return { ipAddress: ip, userAgent, deviceLabel };
}

export async function writePlatformAuditLog(input: PlatformAuditInput): Promise<void> {
  const meta = await getRequestAuditMeta();
  await db.platformAuditLog.create({
    data: {
      platformUserId: input.platformUserId,
      ownerEmail: input.ownerEmail,
      action: input.action,
      targetTenantId: input.targetTenantId ?? null,
      targetUserId: input.targetUserId ?? null,
      previousState: input.previousState,
      newState: input.newState,
      metadata: input.metadata,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      deviceLabel: meta.deviceLabel,
    },
  });
}

export async function listPlatformAuditLogs(options: {
  limit?: number;
  offset?: number;
  targetTenantId?: string;
  action?: string;
}) {
  const limit = Math.min(options.limit ?? 50, 100);
  const offset = options.offset ?? 0;

  return db.platformAuditLog.findMany({
    where: {
      ...(options.targetTenantId ? { targetTenantId: options.targetTenantId } : {}),
      ...(options.action ? { action: options.action } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  });
}
