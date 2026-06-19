/**
 * Repara confirmaciones Airbnb mal clasificadas como CANCELED y backfill de $0.
 *
 *   npx tsx scripts/run-finance-airbnb-repair.ts [organizationId]
 */
import { config } from "dotenv";
import { runMisclassifiedConfirmationRepairJob } from "@/modules/airbnb-email/repair/run-misclassified-confirmation-repair-job";
import { runZeroAmountFinancialBackfillJob } from "@/modules/airbnb-email/repair/run-zero-amount-financial-backfill-job";

config();
config({ path: ".env.local", override: true });

const orgId = process.argv[2]?.trim() || undefined;

async function main() {
  const misclassified = await runMisclassifiedConfirmationRepairJob({
    organizationId: orgId,
    limit: 80,
  });
  const zeroAmount = await runZeroAmountFinancialBackfillJob({
    organizationId: orgId,
    limit: 80,
  });

  console.log(
    JSON.stringify(
      {
        organizationId: orgId ?? "all",
        misclassified,
        zeroAmount,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
