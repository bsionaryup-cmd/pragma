import "server-only";

import { db } from "@/lib/db";
import {
  classifyDbHealth,
  classifyEnvFlag,
  classifyOutboxHealth,
  worstStatus,
  type HealthStatus,
} from "@/services/platform/platform-health-classify";

export type { HealthStatus };
export {
  classifyDbHealth,
  classifyEnvFlag,
  classifyOutboxHealth,
  worstStatus,
} from "@/services/platform/platform-health-classify";

export type HealthCheckItem = {
  id: string;
  label: string;
  status: HealthStatus;
  detail: string;
};

export type PlatformHealthSnapshot = {
  generatedAt: string;
  overall: HealthStatus;
  checks: HealthCheckItem[];
  intel: {
    pending: number;
    failed: number;
    processing: number;
    lastDoneAt: string | null;
    oldestPendingAgeMinutes: number | null;
    recentFailed: Array<{
      id: string;
      type: string;
      storeId: string;
      lastError: string | null;
      attempts: number;
      updatedAt: string;
    }>;
  };
};

export async function getPlatformHealthSnapshot(): Promise<PlatformHealthSnapshot> {
  let dbOk = false;
  try {
    await db.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const orgCount = await db.organization.count({ where: { deletedAt: null } });
  const propertyCount = await db.property.count();

  let retailStoreCount = 0;
  let mobilityAllyCount = 0;
  let pending = 0;
  let failed = 0;
  let processing = 0;
  let oldestPending: { createdAt: Date } | null = null;
  let lastDone: { processedAt: Date | null } | null = null;
  let recentFailed: Array<{
    id: string;
    type: string;
    storeId: string;
    lastError: string | null;
    attempts: number;
    createdAt: Date;
  }> = [];

  try {
    [
      retailStoreCount,
      mobilityAllyCount,
      pending,
      failed,
      processing,
      oldestPending,
      lastDone,
      recentFailed,
    ] = await Promise.all([
      db.retailStore.count({ where: { deletedAt: null, status: "ACTIVE" } }),
      db.mobilityAlly.count(),
      db.retailIntelOutbox.count({ where: { status: "PENDING" } }),
      db.retailIntelOutbox.count({ where: { status: "FAILED" } }),
      db.retailIntelOutbox.count({ where: { status: "PROCESSING" } }),
      db.retailIntelOutbox.findFirst({
        where: { status: "PENDING" },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
      db.retailIntelOutbox.findFirst({
        where: { status: "DONE" },
        orderBy: { processedAt: "desc" },
        select: { processedAt: true },
      }),
      db.retailIntelOutbox.findMany({
        where: { status: "FAILED" },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          type: true,
          storeId: true,
          lastError: true,
          attempts: true,
          createdAt: true,
        },
      }),
    ]);
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: string }).code)
        : "";
    // Retail / mobility tables may be absent after product eradication (P2021).
    if (code !== "P2021" && code !== "P2022") throw error;
  }

  const oldestPendingAgeMinutes = oldestPending
    ? Math.round((Date.now() - oldestPending.createdAt.getTime()) / 60_000)
    : null;

  const intelStatus = classifyOutboxHealth({
    failed,
    pending,
    oldestPendingAgeMinutes,
    lastDoneAt: lastDone?.processedAt ?? null,
    hasRetailStores: retailStoreCount > 0,
  });

  const checks: HealthCheckItem[] = [
    {
      id: "database",
      label: "Database",
      status: classifyDbHealth(dbOk),
      detail: dbOk ? "Conectividad OK (SELECT 1)" : "No responde SELECT 1",
    },
    {
      id: "core",
      label: "Core",
      status: orgCount > 0 ? "PASS" : "WARN",
      detail: `${orgCount} organizaciones activas (deletedAt null)`,
    },
    {
      id: "pms",
      label: "PMS",
      status: propertyCount > 0 ? "PASS" : "WARN",
      detail: `${propertyCount} propiedades registradas`,
    },
    {
      id: "retail",
      label: "Retail (INTIENDAS)",
      status: retailStoreCount > 0 ? "PASS" : "WARN",
      detail:
        retailStoreCount > 0
          ? `${retailStoreCount} tiendas ACTIVE`
          : "0 tiendas ACTIVE (tabla ausente o sin datos)",
    },
    {
      id: "qr-mobility",
      label: "QR Mobility",
      status: "PASS",
      detail: `${mobilityAllyCount} aliados (módulo aislado)`,
    },
    {
      id: "inventory-intelligence",
      label: "Inventory Intelligence",
      status: intelStatus,
      detail: `PENDING ${pending} · FAILED ${failed} · PROCESSING ${processing}${
        oldestPendingAgeMinutes != null
          ? ` · pending más antiguo ${oldestPendingAgeMinutes} min`
          : ""
      }`,
    },
    {
      id: "workers",
      label: "Workers / Outbox",
      status: processing > 5 ? "WARN" : intelStatus === "FAIL" ? "FAIL" : "PASS",
      detail:
        processing > 5
          ? `${processing} eventos PROCESSING (posible claim atorado)`
          : "Cola sin claims anormales",
    },
    {
      id: "cron",
      label: "Cron retail-intel",
      status: classifyEnvFlag(Boolean(process.env.CRON_SECRET?.trim()), true),
      detail: process.env.CRON_SECRET?.trim()
        ? "CRON_SECRET configurado · schedule diario 08:00 UTC (safety net)"
        : "CRON_SECRET ausente — cron deshabilitado",
    },
    {
      id: "queue",
      label: "Queue (RetailIntelOutbox)",
      status: pending > 200 ? "WARN" : "PASS",
      detail: `${pending} eventos pendientes / límite blando 200`,
    },
  ];

  return {
    generatedAt: new Date().toISOString(),
    overall: worstStatus(checks.map((c) => c.status)),
    checks,
    intel: {
      pending,
      failed,
      processing,
      lastDoneAt: lastDone?.processedAt?.toISOString() ?? null,
      oldestPendingAgeMinutes,
      recentFailed: recentFailed.map((row) => ({
        id: row.id,
        type: row.type,
        storeId: row.storeId,
        lastError: row.lastError,
        attempts: row.attempts,
        updatedAt: row.createdAt.toISOString(),
      })),
    },
  };
}
