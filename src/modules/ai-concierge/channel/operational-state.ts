import "server-only";

import { createHash } from "node:crypto";
import type {
  ConciergeConfiguration,
  ConciergeOperationMode as DbConciergeOperationMode,
  Prisma,
} from "@prisma/client";
import { db } from "@/lib/db";
import type { ConciergeOperationMode } from "@/modules/ai-concierge/channel/session-store";
import {
  createConciergeExtensionSession,
  createConciergePairingSecret,
  hashConciergeDeviceId,
  hashConciergePairingSecret,
} from "@/modules/ai-concierge/channel/session-token";
import { normalizeHeartbeatChannels } from "@/modules/ai-concierge/channel/heartbeat-channel-status";

const PAIRING_TTL_MS = 2 * 60 * 1000;

export type ConciergeConfigurationPatch = {
  enabled?: boolean;
  paused?: boolean;
  mode?: ConciergeOperationMode;
  whatsappEnabled?: boolean;
  airbnbEnabled?: boolean;
  allowedPropertyIds?: string[];
  allowedTools?: string[];
  aiEnabled?: boolean;
  auditorEnabled?: boolean;
};

export function toRuntimeConciergeMode(
  mode: DbConciergeOperationMode,
): ConciergeOperationMode {
  return mode.toLowerCase() as ConciergeOperationMode;
}

function toDbConciergeMode(
  mode: ConciergeOperationMode,
): DbConciergeOperationMode {
  return mode.toUpperCase() as DbConciergeOperationMode;
}

export async function getOrCreateConciergeConfiguration(input: {
  organizationId: string;
  userId: string;
}): Promise<ConciergeConfiguration> {
  return db.conciergeConfiguration.upsert({
    where: { organizationId: input.organizationId },
    create: {
      organizationId: input.organizationId,
      updatedById: input.userId,
    },
    update: {},
  });
}

export async function updateConciergeConfiguration(input: {
  organizationId: string;
  userId: string;
  patch: ConciergeConfigurationPatch;
}): Promise<ConciergeConfiguration> {
  const data: Prisma.ConciergeConfigurationUpdateInput = {
    updatedBy: { connect: { id: input.userId } },
  };
  if (input.patch.enabled !== undefined) data.enabled = input.patch.enabled;
  if (input.patch.paused !== undefined) data.paused = input.patch.paused;
  if (input.patch.mode) data.mode = toDbConciergeMode(input.patch.mode);
  if (input.patch.whatsappEnabled !== undefined) {
    data.whatsappEnabled = input.patch.whatsappEnabled;
  }
  if (input.patch.airbnbEnabled !== undefined) {
    data.airbnbEnabled = input.patch.airbnbEnabled;
  }
  if (input.patch.allowedPropertyIds) {
    data.allowedPropertyIds = input.patch.allowedPropertyIds;
  }
  if (input.patch.allowedTools) {
    data.allowedTools = input.patch.allowedTools;
  }
  if (input.patch.aiEnabled !== undefined) {
    data.aiEnabled = input.patch.aiEnabled;
  }
  if (input.patch.auditorEnabled !== undefined) {
    data.auditorEnabled = input.patch.auditorEnabled;
  }

  const config = await db.conciergeConfiguration.upsert({
    where: { organizationId: input.organizationId },
    create: {
      organizationId: input.organizationId,
      updatedById: input.userId,
      enabled: input.patch.enabled ?? false,
      paused: input.patch.paused ?? false,
      mode: input.patch.mode
        ? toDbConciergeMode(input.patch.mode)
        : "MANUAL",
      whatsappEnabled: input.patch.whatsappEnabled ?? true,
      airbnbEnabled: input.patch.airbnbEnabled ?? true,
      allowedPropertyIds: input.patch.allowedPropertyIds ?? [],
      allowedTools: input.patch.allowedTools ?? [],
      aiEnabled: input.patch.aiEnabled ?? false,
      auditorEnabled: input.patch.auditorEnabled ?? true,
    },
    update: data,
  });

  await db.conciergeAuditEvent.create({
    data: {
      organizationId: input.organizationId,
      eventType: "configuration.updated",
      result: "success",
      metadata: {
        fields: Object.keys(input.patch),
        enabled: config.enabled,
        paused: config.paused,
        mode: config.mode,
      },
    },
  });
  return config;
}

export async function createConciergePairingChallenge(input: {
  organizationId: string;
  userId: string;
  deviceId: string;
  version?: string | null;
}): Promise<{ pairingToken: string; expiresAt: string }> {
  await getOrCreateConciergeConfiguration(input);
  const secret = createConciergePairingSecret();
  const expiresAt = new Date(Date.now() + PAIRING_TTL_MS);
  const deviceIdHash = hashConciergeDeviceId(input.deviceId);

  await db.$transaction(async (tx) => {
    await tx.conciergeExtensionLink.deleteMany({
      where: {
        organizationId: input.organizationId,
        status: { in: ["PENDING", "REVOKED"] },
        pairedAt: null,
        lastHeartbeatAt: null,
      },
    });
    const existing = await tx.conciergeExtensionLink.findUnique({
      where: {
        organizationId_deviceIdHash: {
          organizationId: input.organizationId,
          deviceIdHash,
        },
      },
    });
    if (existing) {
      await tx.conciergeExtensionLink.update({
        where: { id: existing.id },
        data: {
          linkedByUserId: input.userId,
          pairingTokenHash: secret.hash,
          pairingExpiresAt: expiresAt,
          status: "PENDING",
          version: input.version ?? existing.version,
          revokedAt: null,
          lastError: null,
        },
      });
      return;
    }
    await tx.conciergeExtensionLink.create({
      data: {
        organizationId: input.organizationId,
        linkedByUserId: input.userId,
        deviceIdHash,
        pairingTokenHash: secret.hash,
        pairingExpiresAt: expiresAt,
        status: "PENDING",
        version: input.version ?? null,
      },
    });
  });

  return {
    pairingToken: secret.raw,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function renewConciergeExtensionSession(input: {
  organizationId: string;
  userId: string;
  deviceId: string;
  version?: string | null;
}): Promise<{ token: string; expiresAt: string; linkId: string } | null> {
  const deviceHash = hashConciergeDeviceId(input.deviceId);
  const link = await db.conciergeExtensionLink.findUnique({
    where: {
      organizationId_deviceIdHash: {
        organizationId: input.organizationId,
        deviceIdHash: deviceHash,
      },
    },
  });
  if (!link || link.status !== "ACTIVE" || link.revokedAt) return null;

  if (input.version && input.version !== link.version) {
    await db.conciergeExtensionLink.update({
      where: { id: link.id },
      data: { version: input.version },
    });
  }
  const session = createConciergeExtensionSession({
    linkId: link.id,
    organizationId: link.organizationId,
    userId: input.userId,
    deviceHash,
  });
  return { ...session, linkId: link.id };
}

export async function completeConciergePairing(input: {
  pairingToken: string;
  deviceId: string;
  version?: string | null;
}): Promise<{
  token: string;
  expiresAt: string;
  linkId: string;
  organizationId: string;
}> {
  const tokenHash = hashConciergePairingSecret(input.pairingToken);
  const pending = await db.conciergeExtensionLink.findUnique({
    where: { pairingTokenHash: tokenHash },
  });
  if (
    !pending ||
    pending.status !== "PENDING" ||
    !pending.pairingExpiresAt ||
    pending.pairingExpiresAt.getTime() <= Date.now()
  ) {
    throw new Error("PAIRING_INVALID_OR_EXPIRED");
  }

  const deviceHash = hashConciergeDeviceId(input.deviceId);
  if (pending.deviceIdHash !== deviceHash) {
    throw new Error("PAIRING_INVALID_OR_EXPIRED");
  }
  const existing = await db.conciergeExtensionLink.findUnique({
    where: {
      organizationId_deviceIdHash: {
        organizationId: pending.organizationId,
        deviceIdHash: deviceHash,
      },
    },
  });

  const link = await db.$transaction(async (tx) => {
    if (existing && existing.id !== pending.id) {
      await tx.conciergeExtensionLink.delete({ where: { id: pending.id } });
      return tx.conciergeExtensionLink.update({
        where: { id: existing.id },
        data: {
          linkedByUserId: pending.linkedByUserId,
          status: "ACTIVE",
          version: input.version ?? existing.version,
          pairedAt: existing.pairedAt ?? new Date(),
          revokedAt: null,
          lastError: null,
        },
      });
    }
    return tx.conciergeExtensionLink.update({
      where: { id: pending.id },
      data: {
        deviceIdHash: deviceHash,
        pairingTokenHash: null,
        pairingExpiresAt: null,
        status: "ACTIVE",
        version: input.version ?? null,
        pairedAt: new Date(),
        lastError: null,
      },
    });
  });

  await db.conciergeAuditEvent.create({
    data: {
      organizationId: link.organizationId,
      extensionLinkId: link.id,
      eventType: "extension.linked",
      result: "success",
      metadata: { version: link.version },
    },
  });

  const session = createConciergeExtensionSession({
    linkId: link.id,
    organizationId: link.organizationId,
    userId: link.linkedByUserId,
    deviceHash,
  });
  return {
    ...session,
    linkId: link.id,
    organizationId: link.organizationId,
  };
}

export async function recordConciergeHeartbeat(input: {
  linkId: string;
  version?: string | null;
  channels?: Record<string, unknown> | null;
  error?: string | null;
}): Promise<void> {
  const now = new Date();
  // WhatsApp Web stays Online only with a fresh tabAliveAt (honest bridge).
  // Airbnb keeps prior quiet-tab renew behavior via normalizeHeartbeatChannels.
  let channelStatus: Prisma.InputJsonObject | undefined;
  if (input.channels) {
    const refreshed = normalizeHeartbeatChannels(input.channels, now);
    channelStatus = JSON.parse(
      JSON.stringify(refreshed ?? {}),
    ) as Prisma.InputJsonObject;
  }
  await db.conciergeExtensionLink.update({
    where: { id: input.linkId },
    data: {
      version: input.version ?? undefined,
      lastHeartbeatAt: now,
      lastSyncAt: now,
      lastError: input.error ?? null,
      channelStatus,
    },
  });
}

/**
 * Read last outbound ack from extension heartbeat (channelStatus).
 * Used so mayAutoSend anti-dup does not treat "saved in memory" as "sent to WA".
 */
export async function getChannelOutboundAck(input: {
  organizationId: string;
  channel: string;
  threadId?: string | null;
}): Promise<{
  sent: boolean;
  outboundDispatched: boolean;
  duplicate: boolean;
  suggestedPreview: string | null;
  threadId: string | null;
  at: string | null;
} | null> {
  const link = await db.conciergeExtensionLink.findFirst({
    where: {
      organizationId: input.organizationId,
      status: "ACTIVE",
      revokedAt: null,
    },
    orderBy: { lastHeartbeatAt: "desc" },
    select: { channelStatus: true },
  });
  if (!link?.channelStatus || typeof link.channelStatus !== "object") {
    return null;
  }
  const root = link.channelStatus as Record<string, unknown>;
  const row = root[input.channel];
  if (!row || typeof row !== "object" || Array.isArray(row)) return null;
  const ch = row as Record<string, unknown>;
  const threadId = typeof ch.threadId === "string" ? ch.threadId : null;
  if (
    input.threadId &&
    threadId &&
    threadId !== input.threadId
  ) {
    // Different chat — do not use this ack for anti-dup of another thread.
    return null;
  }
  return {
    sent: ch.sent === true,
    outboundDispatched: ch.outboundDispatched === true,
    duplicate: ch.duplicate === true,
    suggestedPreview:
      typeof ch.suggestedPreview === "string" ? ch.suggestedPreview : null,
    threadId,
    at: typeof ch.at === "string" ? ch.at : null,
  };
}

export async function claimConciergeExternalMessage(input: {
  organizationId: string;
  extensionLinkId: string;
  channel: string;
  externalMessageId?: string | null;
  threadId?: string | null;
}): Promise<{ duplicate: boolean; orphan?: boolean }> {
  if (!input.externalMessageId) return { duplicate: false };
  const idempotencyKey = createHash("sha256")
    .update(
      `${input.organizationId}:${input.channel}:${input.externalMessageId}`,
    )
    .digest("hex");

  // Pre-check avoids Prisma unique-constraint error logs on expected duplicates.
  const existing = await db.conciergeAuditEvent.findFirst({
    where: {
      organizationId: input.organizationId,
      idempotencyKey,
      eventType: "message.received",
    },
    orderBy: { createdAt: "asc" },
  });

  if (existing) {
    const threadId =
      input.threadId ||
      (existing.metadata &&
      typeof existing.metadata === "object" &&
      !Array.isArray(existing.metadata) &&
      typeof (existing.metadata as Record<string, unknown>).threadId ===
        "string"
        ? ((existing.metadata as Record<string, unknown>).threadId as string)
        : null);

    const turnAfter = await db.conciergeAuditEvent.findFirst({
      where: {
        organizationId: input.organizationId,
        eventType: "turn.processed",
        createdAt: { gte: new Date(existing.createdAt.getTime() - 2000) },
        ...(threadId
          ? {
              metadata: {
                path: ["threadId"],
                equals: threadId,
              },
            }
          : {
              metadata: {
                path: ["channel"],
                equals: input.channel,
              },
            }),
      },
      orderBy: { createdAt: "asc" },
    });
    if (turnAfter) return { duplicate: true };
    return { duplicate: false, orphan: true };
  }

  try {
    await db.conciergeAuditEvent.create({
      data: {
        organizationId: input.organizationId,
        extensionLinkId: input.extensionLinkId,
        idempotencyKey,
        eventType: "message.received",
        result: "accepted",
        metadata: {
          channel: input.channel,
          ...(input.threadId ? { threadId: input.threadId } : {}),
          externalMessageId: input.externalMessageId,
        },
      },
    });
    return { duplicate: false };
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      // Race: another request created the claim between find and create.
      return { duplicate: true };
    }
    throw error;
  }
}

/** Soft text dedupe window — same guest text can be re-tested after this. */
export const CONCIERGE_TEXT_CLAIM_WINDOW_MS = 45_000;

/**
 * Text-only claim keyed by sliding time window so retries inside the window
 * dedupe, but a later "Hola" (new test) is treated as a fresh message.
 */
export function buildWindowedTextClaimId(input: {
  channel: string;
  threadId: string;
  guestMessage: string;
  nowMs?: number;
  windowMs?: number;
}): string {
  const windowMs = input.windowMs ?? CONCIERGE_TEXT_CLAIM_WINDOW_MS;
  const bucket = Math.floor((input.nowMs ?? Date.now()) / windowMs);
  const base = createHash("sha256")
    .update(`${input.channel}\n${input.threadId}\n${input.guestMessage}`)
    .digest("hex")
    .slice(0, 40);
  return `tmsg:${base}:w${bucket}`;
}

export async function recordConciergeTurnState(input: {
  organizationId: string;
  extensionLinkId: string;
  channel: string;
  threadId: string;
  runId: string;
  intent: string;
  path: string;
  durationMs: number;
  toolNames: string[];
  ok: boolean;
  usedLlm?: boolean;
  llmTokens?: number | null;
  factKeys?: string[];
  observabilityPath?: string;
}): Promise<void> {
  const threadHash = createHash("sha256")
    .update(`${input.organizationId}:${input.channel}:${input.threadId}`)
    .digest("hex");

  const escalated = input.path === "escalate";
  const conversation = await db.conciergeConversationState.upsert({
    where: {
      organizationId_channel_threadHash: {
        organizationId: input.organizationId,
        channel: input.channel,
        threadHash,
      },
    },
    create: {
      organizationId: input.organizationId,
      channel: input.channel,
      threadHash,
      status: escalated ? "ESCALATED" : "ACTIVE",
      messageCount: 1,
      pendingCount: escalated ? 1 : 0,
      escalationCount: escalated ? 1 : 0,
      deterministicCount: input.path === "deterministic" ? 1 : 0,
      llmCount: input.path === "needs_llm" ? 1 : 0,
      errorCount: input.ok ? 0 : 1,
      totalResponseMs: Math.max(0, input.durationMs),
      lastIntent: input.intent,
      lastPath: input.path,
      lastProcessedAt: new Date(),
    },
    update: {
      status: escalated ? "ESCALATED" : "ACTIVE",
      messageCount: { increment: 1 },
      pendingCount: escalated ? { increment: 1 } : undefined,
      escalationCount: escalated ? { increment: 1 } : undefined,
      deterministicCount:
        input.path === "deterministic" ? { increment: 1 } : undefined,
      llmCount: input.path === "needs_llm" ? { increment: 1 } : undefined,
      errorCount: input.ok ? undefined : { increment: 1 },
      totalResponseMs: { increment: Math.max(0, input.durationMs) },
      lastIntent: input.intent,
      lastPath: input.path,
      lastProcessedAt: new Date(),
    },
  });

  await db.conciergeAuditEvent.create({
    data: {
      organizationId: input.organizationId,
      extensionLinkId: input.extensionLinkId,
      conversationStateId: conversation.id,
      runId: input.runId,
      eventType: "turn.processed",
      result: input.ok ? "success" : "error",
      durationMs: Math.max(0, input.durationMs),
      metadata: {
        channel: input.channel,
        threadId: input.threadId,
        intent: input.intent,
        path: input.path,
        toolNames: input.toolNames,
        usedLlm: input.usedLlm ?? false,
        llmTokens: input.llmTokens ?? null,
        factKeys: input.factKeys ?? [],
        observabilityPath: input.observabilityPath ?? input.path,
      },
    },
  });
}

export async function getConciergeDashboard(organizationId: string) {
  const [config, links, grouped, aggregate, audits] = await Promise.all([
    db.conciergeConfiguration.findUnique({ where: { organizationId } }),
    db.conciergeExtensionLink.findMany({
      where: { organizationId, status: { not: "PENDING" } },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
    db.conciergeConversationState.groupBy({
      by: ["status"],
      where: { organizationId },
      _count: { _all: true },
    }),
    db.conciergeConversationState.aggregate({
      where: { organizationId },
      _sum: {
        messageCount: true,
        pendingCount: true,
        deterministicCount: true,
        llmCount: true,
        escalationCount: true,
        errorCount: true,
        totalResponseMs: true,
      },
    }),
    db.conciergeAuditEvent.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  const statusCounts = Object.fromEntries(
    grouped.map((row) => [row.status.toLowerCase(), row._count._all]),
  );
  const sums = aggregate._sum;
  const totalTurns =
    (sums.deterministicCount ?? 0) +
    (sums.llmCount ?? 0) +
    (sums.escalationCount ?? 0);

  return {
    config,
    links,
    serverTime: new Date().toISOString(),
    conversations: {
      active: statusCounts.active ?? 0,
      escalated: statusCounts.escalated ?? 0,
      completed: statusCounts.completed ?? 0,
      messagesProcessed: sums.messageCount ?? 0,
      pending: sums.pendingCount ?? 0,
    },
    metrics: {
      deterministic: sums.deterministicCount ?? 0,
      llm: sums.llmCount ?? 0,
      escalations: sums.escalationCount ?? 0,
      errors: sums.errorCount ?? 0,
      averageResponseMs:
        totalTurns > 0
          ? Math.round((sums.totalResponseMs ?? 0) / totalTurns)
          : 0,
    },
    audits,
  };
}
