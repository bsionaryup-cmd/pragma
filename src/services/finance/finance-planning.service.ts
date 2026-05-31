import { addCalendarDaysToKey, dateKeyToPrismaDate, prismaDateToKey, todayPrismaDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { computeFinancePlanningSnapshot } from "@/lib/finance/finance-planning-calc";
import type {
  FinancePlanningFixedExpense,
  FinancePlanningRepeatedExpenseHint,
  FinancePlanningSettingsInput,
  FinancePlanningSnapshot,
  FinancePlanningVariableExpense,
} from "@/lib/finance/finance-planning-types";
import { formatMoney } from "@/lib/format-currency";
import type { TenantDataScope } from "@/lib/platform/tenant-data-scope";
import { listManualExpensesInRange } from "@/services/finance/finance-prisma-guard";
import type { Locale } from "@/i18n/types";

const EMPTY_SETTINGS: FinancePlanningSettingsInput = {
  fixedExpenses: [],
  variableExpenses: [],
  monthlyProfitGoal: 0,
  propertyId: null,
};

function parseFixedExpenses(value: unknown): FinancePlanningFixedExpense[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const name = String((row as { name?: unknown }).name ?? "").trim();
      const amount = Number((row as { amount?: unknown }).amount);
      if (!name || !Number.isFinite(amount) || amount < 0) return null;
      return { name, amount: Math.round(amount) };
    })
    .filter((row): row is FinancePlanningFixedExpense => row !== null);
}

function parseVariableExpenses(value: unknown): FinancePlanningVariableExpense[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const name = String((row as { name?: unknown }).name ?? "").trim();
      const type = (row as { type?: unknown }).type;
      const valueAmount = Number((row as { value?: unknown }).value);
      if (
        !name ||
        (type !== "percent" && type !== "fixed_per_booking") ||
        !Number.isFinite(valueAmount) ||
        valueAmount < 0
      ) {
        return null;
      }
      return {
        name,
        type,
        value: type === "percent" ? valueAmount : Math.round(valueAmount),
      };
    })
    .filter((row): row is FinancePlanningVariableExpense => row !== null);
}

function detectRepeatedExpenses(
  rows: { category: string; amount: unknown }[],
): FinancePlanningRepeatedExpenseHint[] {
  const counts = new Map<string, { name: string; amount: number; occurrences: number }>();

  for (const row of rows) {
    const name = row.category.trim();
    const amount = Math.round(Number(row.amount));
    if (!name || !Number.isFinite(amount) || amount <= 0) continue;
    const key = `${name.toLowerCase()}::${amount}`;
    const existing = counts.get(key);
    if (existing) {
      existing.occurrences += 1;
      continue;
    }
    counts.set(key, { name, amount, occurrences: 1 });
  }

  return [...counts.values()]
    .filter((row) => row.occurrences >= 3)
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, 5);
}

export async function loadFinancePlanningSnapshot(
  scope: TenantDataScope,
  locale: Locale,
  input: {
    currentRevenue: number;
    currentOccupancyPct: number;
    occupiedNights: number;
    availableNights: number;
    bookingCount: number;
    configuredFixedExpenseNames?: string[];
  },
): Promise<FinancePlanningSnapshot> {
  const formatAmount = (amount: number) => formatMoney(amount, undefined, locale);

  if (!scope.organizationId) {
    return computeFinancePlanningSnapshot({
      settings: EMPTY_SETTINGS,
      currentRevenue: input.currentRevenue,
      currentOccupancyPct: input.currentOccupancyPct,
      occupiedNights: input.occupiedNights,
      availableNights: input.availableNights,
      bookingCount: input.bookingCount,
      formatAmount,
    });
  }

  const lookbackStart = dateKeyToPrismaDate(
    addCalendarDaysToKey(prismaDateToKey(todayPrismaDate()), -90),
  );
  const lookbackEnd = todayPrismaDate();

  const [stored, recentExpenses] = await Promise.all([
    db.financialPlanningSetting.findUnique({
      where: { organizationId: scope.organizationId },
      select: {
        propertyId: true,
        fixedExpenses: true,
        variableExpenses: true,
        monthlyProfitGoal: true,
      },
    }),
    listManualExpensesInRange(lookbackStart, lookbackEnd, scope),
  ]);

  const settings: FinancePlanningSettingsInput = stored
    ? {
        propertyId: stored.propertyId,
        fixedExpenses: parseFixedExpenses(stored.fixedExpenses),
        variableExpenses: parseVariableExpenses(stored.variableExpenses),
        monthlyProfitGoal: Math.round(Number(stored.monthlyProfitGoal)),
      }
    : EMPTY_SETTINGS;

  const snapshot = computeFinancePlanningSnapshot({
    settings,
    currentRevenue: input.currentRevenue,
    currentOccupancyPct: input.currentOccupancyPct,
    occupiedNights: input.occupiedNights,
    availableNights: input.availableNights,
    bookingCount: input.bookingCount,
    formatAmount,
  });

  const configuredNames = new Set(
    (input.configuredFixedExpenseNames ?? settings.fixedExpenses.map((row) => row.name))
      .map((name) => name.trim().toLowerCase())
      .filter(Boolean),
  );

  snapshot.repeatedExpenseHints = detectRepeatedExpenses(recentExpenses).filter(
    (hint) => !configuredNames.has(hint.name.trim().toLowerCase()),
  );

  return snapshot;
}

export function serializeFinancePlanningSettings(
  settings: FinancePlanningSettingsInput,
): FinancePlanningSettingsInput {
  return {
    propertyId: settings.propertyId ?? null,
    monthlyProfitGoal: Math.round(settings.monthlyProfitGoal),
    fixedExpenses: settings.fixedExpenses.map((row) => ({
      name: row.name.trim(),
      amount: Math.round(row.amount),
    })),
    variableExpenses: settings.variableExpenses.map((row) => ({
      name: row.name.trim(),
      type: row.type,
      value: row.type === "percent" ? row.value : Math.round(row.value),
    })),
  };
}
