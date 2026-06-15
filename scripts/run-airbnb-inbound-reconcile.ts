/**
 * Ejecuta localmente la misma lógica que GET /api/cron/airbnb-email-inbound-reconcile
 *
 *   npx tsx scripts/run-airbnb-inbound-reconcile.ts
 */
import { config } from "dotenv";
import { reconcileMissedResendInboundEmails } from "@/modules/airbnb-email/ingestion/reconcile-resend-inbound";
import { isResendInboundConfigured } from "@/modules/airbnb-email/integrations/resend-inbound.client";
import { runUnlinkedEmailEnrichmentRetryJob } from "@/modules/airbnb-email/matching/unlinked-email-enrichment-retry";

config();
config({ path: ".env.local", override: true });
if (process.env.USE_VERCEL_PRODUCTION_ENV === "1") {
  config({ path: ".env.vercel.production", override: true });
}

async function main() {
  const startedAt = Date.now();
  console.log("[cron] airbnb-email-inbound-reconcile start");

  let resend: Awaited<ReturnType<typeof reconcileMissedResendInboundEmails>> | null =
    null;

  const resendConfigured = isResendInboundConfigured();
  const hasApiKey = Boolean(process.env.RESEND_API_KEY?.trim());
  console.log({ resendConfigured, hasApiKey });

  if (hasApiKey) {
    try {
      resend = await reconcileMissedResendInboundEmails({ limit: 40, maxPages: 3 });
    } catch (error) {
      console.error("[cron] resend poll failed:", error);
    }
  } else {
    console.warn("[cron] Resend poll skipped (RESEND_API_KEY missing)");
  }

  const retry = await runUnlinkedEmailEnrichmentRetryJob({
    limit: 60,
    lookbackHours: 24 * 30,
  });

  const result = {
    ok: true,
    durationMs: Date.now() - startedAt,
    resend,
    retry,
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
