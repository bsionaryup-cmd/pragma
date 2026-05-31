import { revalidatePath } from "next/cache";
import {
  listMonthKeysForStay,
  unionMonthKeys,
} from "@/lib/finance/monthly-finance-month-keys";
import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";
import { recalculateMonthlyFinanceMetrics } from "@/services/finance/monthly-finance-metrics.service";

let pendingMonthKeys = new Set<string>();
let flushScheduled = false;

function scheduleFlush(): void {
  if (flushScheduled) return;
  flushScheduled = true;

  queueMicrotask(() => {
    void flushPendingMonthlyFinanceMetrics();
  });
}

async function flushPendingMonthlyFinanceMetrics(): Promise<void> {
  const monthKeys = [...pendingMonthKeys];
  pendingMonthKeys = new Set();
  flushScheduled = false;

  if (monthKeys.length === 0) return;

  try {
    const scope = await requireTenantDataScope();
    await recalculateMonthlyFinanceMetrics(scope, monthKeys);
    revalidatePath("/finance");
  } catch (error) {
    console.error("[monthly-finance-metrics] refresh failed", error);
  }
}

export function scheduleMonthlyFinanceMetricsRefresh(
  monthKeys: string[],
): void {
  if (monthKeys.length === 0) return;

  for (const monthKey of monthKeys) {
    pendingMonthKeys.add(monthKey);
  }

  scheduleFlush();
}

export function scheduleMonthlyFinanceMetricsRefreshForStay(
  before: { checkIn: string; checkOut: string } | null,
  after: { checkIn: string; checkOut: string } | null,
): void {
  const keys: string[][] = [];
  if (before) {
    keys.push(listMonthKeysForStay(before.checkIn, before.checkOut));
  }
  if (after) {
    keys.push(listMonthKeysForStay(after.checkIn, after.checkOut));
  }

  scheduleMonthlyFinanceMetricsRefresh(unionMonthKeys(...keys));
}
