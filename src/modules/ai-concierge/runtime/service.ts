import "server-only";

import type { ConciergeRuntimeStatus as DbRuntimeStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { runConciergeWatchdog } from "@/modules/ai-concierge/runtime/watchdog";
import {
  isRuntimeProcessing,
  parseRuntimeStatus,
  transitionRuntime,
} from "@/modules/ai-concierge/runtime/state-machine";
import { superviseChannels } from "@/modules/ai-concierge/runtime/channel-supervisor";
import type {
  ConciergeRuntimeCommand,
  ConciergeRuntimeStatus,
} from "@/modules/ai-concierge/runtime/types";

const HEARTBEAT_FRESH_MS = 90_000;

function toDbStatus(status: ConciergeRuntimeStatus): DbRuntimeStatus {
  return status as DbRuntimeStatus;
}

function fromDbStatus(status: DbRuntimeStatus | string | null | undefined): ConciergeRuntimeStatus {
  return parseRuntimeStatus(status);
}

async function auditTransition(input: {
  organizationId: string;
  from: ConciergeRuntimeStatus;
  to: ConciergeRuntimeStatus;
  reason: string;
}): Promise<void> {
  await db.conciergeAuditEvent.create({
    data: {
      organizationId: input.organizationId,
      eventType: "runtime.transition",
      result: "success",
      metadata: {
        from: input.from,
        to: input.to,
        reason: input.reason,
      },
    },
  });
}

export async function setConciergeRuntimeDesired(input: {
  organizationId: string;
  userId: string;
  desiredOn: boolean;
}): Promise<{
  runtimeStatus: ConciergeRuntimeStatus;
  runtimeDesiredOn: boolean;
}> {
  const config = await db.conciergeConfiguration.upsert({
    where: { organizationId: input.organizationId },
    create: {
      organizationId: input.organizationId,
      updatedById: input.userId,
      runtimeDesiredOn: input.desiredOn,
      runtimeStatus: input.desiredOn ? "STARTING" : "OFF",
      runtimeLastTransitionAt: new Date(),
      enabled: input.desiredOn,
      paused: false,
    },
    update: {
      updatedById: input.userId,
      runtimeDesiredOn: input.desiredOn,
      runtimeStatus: input.desiredOn ? "STARTING" : "STOPPING",
      runtimeLastTransitionAt: new Date(),
      runtimeLastError: null,
      ...(input.desiredOn ? { enabled: true, paused: false } : {}),
    },
  });

  await auditTransition({
    organizationId: input.organizationId,
    from: fromDbStatus(config.runtimeStatus),
    to: input.desiredOn ? "STARTING" : "STOPPING",
    reason: input.desiredOn ? "Owner activó Runtime" : "Owner detuvo Runtime",
  });

  // Immediate tick so STARTING → RUNNING or STOPPING → OFF when possible
  const snapshot = await tickConciergeRuntime({
    organizationId: input.organizationId,
  });

  return {
    runtimeStatus: snapshot.runtimeStatus,
    runtimeDesiredOn: snapshot.runtimeDesiredOn,
  };
}

export async function tickConciergeRuntime(input: {
  organizationId: string;
}): Promise<{
  runtimeStatus: ConciergeRuntimeStatus;
  runtimeDesiredOn: boolean;
  commands: ConciergeRuntimeCommand[];
  channels: ReturnType<typeof superviseChannels>["channels"];
  issues: string[];
  processing: boolean;
}> {
  const config = await db.conciergeConfiguration.findUnique({
    where: { organizationId: input.organizationId },
  });
  if (!config) {
    return {
      runtimeStatus: "OFF",
      runtimeDesiredOn: false,
      commands: [{ type: "stop_processing" }],
      channels: [],
      issues: ["Sin configuración"],
      processing: false,
    };
  }

  // Prefer the freshest heartbeat. Postgres ORDER BY DESC puts NULLs first,
  // which wrongly selected zombie ACTIVE links over the live extension.
  const links = await db.conciergeExtensionLink.findMany({
    where: {
      organizationId: input.organizationId,
      status: "ACTIVE",
      revokedAt: null,
    },
    orderBy: { lastHeartbeatAt: "desc" },
    take: 20,
  });
  const link =
    links
      .filter((row) => row.lastHeartbeatAt != null)
      .sort(
        (a, b) =>
          (b.lastHeartbeatAt?.getTime() ?? 0) -
          (a.lastHeartbeatAt?.getTime() ?? 0),
      )[0] ?? links[0] ?? null;

  const now = Date.now();
  const extensionConnected = Boolean(
    link?.lastHeartbeatAt &&
      now - link.lastHeartbeatAt.getTime() < HEARTBEAT_FRESH_MS,
  );

  const current = fromDbStatus(config.runtimeStatus);
  const verdict = runConciergeWatchdog({
    desiredOn: config.runtimeDesiredOn,
    status: current,
    whatsappEnabled: config.whatsappEnabled,
    airbnbEnabled: config.airbnbEnabled,
    channelStatus: link?.channelStatus ?? null,
    linkHeartbeatAt: link?.lastHeartbeatAt ?? null,
    extensionConnected,
    lastError: config.runtimeLastError,
    nowMs: now,
  });

  let next = verdict.recommendedStatus;

  // Owner off: force STOPPING → OFF
  if (!config.runtimeDesiredOn) {
    next = current === "OFF" ? "OFF" : current === "STOPPING" ? "OFF" : "STOPPING";
  }

  const transition = transitionRuntime({
    from: current,
    to: next,
    reason: verdict.issues[0] ?? `watchdog→${next}`,
  });

  const supervised = superviseChannels({
    whatsappEnabled: config.whatsappEnabled,
    airbnbEnabled: config.airbnbEnabled,
    channelStatus: link?.channelStatus ?? null,
    linkHeartbeatAt: link?.lastHeartbeatAt ?? null,
    extensionConnected,
    nowMs: now,
  });

  const meta: Prisma.InputJsonObject = {
    channels: supervised.channels as unknown as Prisma.InputJsonValue,
    issues: verdict.issues,
    commands: verdict.commands as unknown as Prisma.InputJsonValue,
    extensionConnected,
    watchdogAt: new Date(now).toISOString(),
  };

  if (transition && transition.from !== transition.to) {
    await db.conciergeConfiguration.update({
      where: { organizationId: input.organizationId },
      data: {
        runtimeStatus: toDbStatus(transition.to),
        runtimeLastTransitionAt: new Date(),
        runtimeWatchdogAt: new Date(),
        runtimeLastError: verdict.healthy
          ? null
          : verdict.issues[0] ?? "watchdog",
        runtimeMeta: meta,
      },
    });
    await auditTransition({
      organizationId: input.organizationId,
      from: transition.from,
      to: transition.to,
      reason: transition.reason,
    });
  } else {
    await db.conciergeConfiguration.update({
      where: { organizationId: input.organizationId },
      data: {
        runtimeWatchdogAt: new Date(),
        runtimeMeta: meta,
      },
    });
  }

  const finalStatus =
    transition && transition.from !== transition.to ? transition.to : current;

  return {
    runtimeStatus: finalStatus,
    runtimeDesiredOn: config.runtimeDesiredOn,
    commands: verdict.commands,
    channels: supervised.channels,
    issues: verdict.issues,
    processing: isRuntimeProcessing(finalStatus) && config.runtimeDesiredOn,
  };
}

export async function getConciergeRuntimeSnapshot(organizationId: string) {
  const config = await db.conciergeConfiguration.findUnique({
    where: { organizationId },
    select: {
      runtimeDesiredOn: true,
      runtimeStatus: true,
      runtimeLastTransitionAt: true,
      runtimeLastError: true,
      runtimeWatchdogAt: true,
      runtimeMeta: true,
      enabled: true,
      paused: true,
      mode: true,
      whatsappEnabled: true,
      airbnbEnabled: true,
    },
  });
  return {
    runtimeDesiredOn: config?.runtimeDesiredOn ?? false,
    runtimeStatus: fromDbStatus(config?.runtimeStatus),
    runtimeLastTransitionAt: config?.runtimeLastTransitionAt?.toISOString() ?? null,
    runtimeLastError: config?.runtimeLastError ?? null,
    runtimeWatchdogAt: config?.runtimeWatchdogAt?.toISOString() ?? null,
    runtimeMeta: config?.runtimeMeta ?? null,
    enabled: config?.enabled ?? false,
    paused: config?.paused ?? false,
    mode: config?.mode ?? "MANUAL",
    whatsappEnabled: config?.whatsappEnabled ?? true,
    airbnbEnabled: config?.airbnbEnabled ?? true,
  };
}
