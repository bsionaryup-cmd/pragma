import "server-only";

import { after } from "next/server";
import { drainIntelOutbox } from "@/domains/retail-intelligence/services/worker.service";
import { logIntelObs } from "@/domains/retail-intelligence/services/observability";

/**
 * Non-blocking outbox drain after a retail write commits.
 * Primary processing path (events) — daily cron remains a Hobby-safe safety net.
 */
export function scheduleIntelOutboxDrain(limit = 75): void {
  const run = async () => {
    try {
      const drained = await drainIntelOutbox(limit);
      logIntelObs("info", "outbox_drain_scheduled", { drained, limit });
    } catch (error) {
      logIntelObs("error", "outbox_drain_scheduled_failed", {
        limit,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  try {
    after(() => {
      void run();
    });
  } catch {
    // Outside a Next.js request context (scripts/tests): best-effort background.
    void run();
  }
}
