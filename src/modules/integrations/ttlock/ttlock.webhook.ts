import { AccessEventType } from "@prisma/client";
import { db } from "@/lib/db";
import type { TTLockWebhookPayload } from "@/modules/integrations/ttlock/ttlock.types";
import {
  getTTLockIntegrationForOrganization,
} from "@/modules/integrations/ttlock/ttlock.persistence";

export type TTLockWebhookResult = {
  ok: boolean;
  status: number;
  message: string;
};

export async function processTTLockWebhook(input: {
  organizationId: string;
  payload: TTLockWebhookPayload;
  rawBody: string;
}): Promise<TTLockWebhookResult> {
  const integration = await getTTLockIntegrationForOrganization(
    input.organizationId,
  );

  if (!integration?.isActive) {
    return { ok: false, status: 404, message: "Integración no encontrada" };
  }

  const eventName = String(input.payload.event ?? "unknown");
  const lockId = input.payload.lockId;

  await db.accessEvent.create({
    data: {
      integrationId: integration.id,
      eventType: AccessEventType.LOCK_SYNCED,
      payload: {
        source: "webhook",
        event: eventName,
        lockId,
        electricQuantity: input.payload.electricQuantity,
      },
    },
  });

  if (lockId != null) {
    const lock = await db.propertyLock.findFirst({
      where: {
        integrationId: integration.id,
        ttlockLockId: String(lockId),
      },
    });

    if (lock) {
      const battery =
        typeof input.payload.electricQuantity === "number"
          ? input.payload.electricQuantity
          : undefined;

      await db.propertyLock.update({
        where: { id: lock.id },
        data: {
          lastSyncAt: new Date(),
          ...(battery != null ? { batteryLevel: battery } : {}),
        },
      });
    }
  }

  return { ok: true, status: 200, message: "Webhook procesado" };
}
