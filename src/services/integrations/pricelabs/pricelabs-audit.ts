import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { isPriceLabsSchemaDriftError } from "@/services/integrations/pricelabs/pricelabs-prisma-guard";

export type PriceLabsAuditResult = "success" | "failure" | "skipped";

export type PriceLabsAuditSource =
  | "manual"
  | "cron"
  | "reservation"
  | "system"
  | "pipeline";

export async function appendPriceLabsSyncLog(input: {
  action: string;
  result: PriceLabsAuditResult;
  message?: string | null;
  source?: PriceLabsAuditSource;
  meta?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    await db.priceLabsSyncLog.create({
      data: {
        action: input.action,
        result: input.result,
        message: input.message ?? null,
        source: input.source ?? "system",
        meta: input.meta
          ? (input.meta as Prisma.InputJsonValue)
          : undefined,
      },
    });
  } catch (error) {
    if (isPriceLabsSchemaDriftError(error)) return;
    console.warn("[pricelabs] audit log write failed", error);
  }
}

export async function listPriceLabsSyncLogs(limit = 20) {
  try {
    return await db.priceLabsSyncLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        action: true,
        result: true,
        message: true,
        source: true,
        createdAt: true,
      },
    });
  } catch (error) {
    if (isPriceLabsSchemaDriftError(error)) return [];
    throw error;
  }
}
