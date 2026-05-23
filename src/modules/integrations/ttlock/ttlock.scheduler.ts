import {
  AccessEventType,
  TTLockLockStatus,
  TTLockOnlineState,
} from "@prisma/client";
import { db } from "@/lib/db";
import { requestTTLockLockList } from "@/modules/integrations/ttlock/ttlock.client";
import {
  getTTLockIntegrationForOrganization,
  isTTLockIntegrationConnected,
} from "@/modules/integrations/ttlock/ttlock.persistence";
import { isTTLockLiveApiEnabled } from "@/services/integrations/ttlock/ttlock-oauth.client";
import {
  decryptTTLockSecret,
} from "@/services/integrations/ttlock/ttlock-crypto";

const SYNC_INTERVAL_MS = 8 * 60 * 1000;

export type TTLockSyncSummary = {
  organizationId: string;
  locksChecked: number;
  locksUpdated: number;
  errors: string[];
};

export async function syncSmartLocksForOrganization(
  organizationId: string,
): Promise<TTLockSyncSummary> {
  const summary: TTLockSyncSummary = {
    organizationId,
    locksChecked: 0,
    locksUpdated: 0,
    errors: [],
  };

  const integration = await getTTLockIntegrationForOrganization(organizationId);
  if (!integration || !isTTLockIntegrationConnected(integration)) {
    summary.errors.push("Integración TTLock no conectada");
    return summary;
  }

  const locks = await db.propertyLock.findMany({
    where: {
      integrationId: integration.id,
      property: { organizationId },
    },
    select: {
      id: true,
      ttlockLockId: true,
      lastSyncAt: true,
    },
  });

  summary.locksChecked = locks.length;

  if (!isTTLockLiveApiEnabled()) {
    const now = new Date();
    for (const lock of locks) {
      await db.propertyLock.update({
        where: { id: lock.id },
        data: { lastSyncAt: now },
      });
      summary.locksUpdated += 1;
    }
    await db.tTLockIntegration.update({
      where: { id: integration.id },
      data: { lastSyncedAt: now },
    });
    return summary;
  }

  const accessToken = decryptTTLockSecret(integration.accessTokenEncrypted);
  if (!accessToken || !integration.clientId) {
    summary.errors.push("Sin token TTLock válido");
    return summary;
  }

  const listResult = await requestTTLockLockList({
    environment: integration.environment,
    clientId: integration.clientId,
    accessToken,
    pageSize: 100,
  });

  if (!listResult.ok) {
    summary.errors.push(listResult.message);
    await db.accessEvent.create({
      data: {
        integrationId: integration.id,
        eventType: AccessEventType.LOCK_SYNC_FAILED,
        payload: { message: listResult.message },
      },
    });
    return summary;
  }

  const now = new Date();
  for (const lock of locks) {
    await db.propertyLock.update({
      where: { id: lock.id },
      data: {
        lastSyncAt: now,
        lockStatus: lock.ttlockLockId
          ? TTLockLockStatus.MAPPED
          : TTLockLockStatus.UNMAPPED,
        onlineState: TTLockOnlineState.UNKNOWN,
      },
    });
    summary.locksUpdated += 1;
  }

  await db.tTLockIntegration.update({
    where: { id: integration.id },
    data: { lastSyncedAt: now, lastError: null },
  });

  await db.accessEvent.create({
    data: {
      integrationId: integration.id,
      eventType: AccessEventType.LOCK_SYNCED,
      payload: {
        mode: "scheduled_poll",
        locksChecked: summary.locksChecked,
        intervalMs: SYNC_INTERVAL_MS,
      },
    },
  });

  return summary;
}

export async function runTTLockScheduledSync(): Promise<{
  organizationsProcessed: number;
  summaries: TTLockSyncSummary[];
}> {
  const integrations = await db.tTLockIntegration.findMany({
    where: {
      isActive: true,
      organizationId: { not: null },
      status: { in: ["CONNECTED", "READY"] },
    },
    select: { organizationId: true },
  });

  const orgIds = [
    ...new Set(
      integrations
        .map((row) => row.organizationId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const summaries: TTLockSyncSummary[] = [];
  for (const organizationId of orgIds) {
    summaries.push(await syncSmartLocksForOrganization(organizationId));
  }

  return {
    organizationsProcessed: orgIds.length,
    summaries,
  };
}
