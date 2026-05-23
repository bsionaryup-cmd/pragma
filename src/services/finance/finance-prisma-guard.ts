import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { TenantDataScope } from "@/lib/platform/tenant-data-scope";
import {
  manualExpenseWhere,
  otherIncomeWhere,
} from "@/lib/platform/tenant-data-scope";

export const FINANCE_SCHEMA_DRIFT_HINT =
  "Finanzas: ejecuta npx prisma generate y npm run db:migrate:deploy";

type ManualExpenseDelegate = {
  findMany: (args: unknown) => Promise<
    Array<{
      id: string;
      amount: { toString(): string };
      category: string;
      expenseDate: Date;
      description?: string | null;
    }>
  >;
};

type OtherIncomeDelegate = {
  findMany: (args: unknown) => Promise<
    Array<{
      id: string;
      amount: { toString(): string };
      incomeType: string;
      incomeDate: Date;
      description?: string | null;
    }>
  >;
};

export function getFinanceDelegates(): {
  manualExpense: ManualExpenseDelegate | null;
  otherIncome: OtherIncomeDelegate | null;
} {
  const client = db as {
    manualExpense?: ManualExpenseDelegate;
    otherIncome?: OtherIncomeDelegate;
  };

  const manualExpense =
    client.manualExpense &&
    typeof client.manualExpense.findMany === "function"
      ? client.manualExpense
      : null;

  const otherIncome =
    client.otherIncome && typeof client.otherIncome.findMany === "function"
      ? client.otherIncome
      : null;

  return { manualExpense, otherIncome };
}

export function assertFinanceDelegates(): void {
  const { manualExpense, otherIncome } = getFinanceDelegates();
  if (!manualExpense || !otherIncome) {
    throw new Error(FINANCE_SCHEMA_DRIFT_HINT);
  }
}

export function isFinanceSchemaDriftError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2021" || error.code === "P2022") return true;
    const table = error.meta?.table;
    if (
      typeof table === "string" &&
      (table.includes("manual_expenses") || table.includes("other_incomes"))
    ) {
      return true;
    }
  }

  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes(FINANCE_SCHEMA_DRIFT_HINT) ||
    (message.includes("manual_expenses") && message.includes("does not exist")) ||
    (message.includes("other_incomes") && message.includes("does not exist")) ||
    (message.includes("Cannot read properties of undefined") &&
      message.includes("findMany"))
  );
}

export async function listManualExpensesInRange(
  start: Date,
  end: Date,
  scope: TenantDataScope,
): Promise<
  Array<{
    id: string;
    amount: { toString(): string };
    category: string;
    expenseDate: Date;
  }>
> {
  const { manualExpense } = getFinanceDelegates();
  if (!manualExpense) {
    console.error("[finance] manualExpense delegate missing —", FINANCE_SCHEMA_DRIFT_HINT);
    return [];
  }

  try {
    return await manualExpense.findMany({
      where: {
        ...manualExpenseWhere(scope),
        expenseDate: { gte: start, lte: end },
      },
      select: { id: true, amount: true, category: true, expenseDate: true, description: true },
    });
  } catch (error) {
    if (isFinanceSchemaDriftError(error)) {
      console.error("[finance] manual_expenses query failed:", error);
      return [];
    }
    throw error;
  }
}

export async function listOtherIncomesInRange(
  start: Date,
  end: Date,
  scope: TenantDataScope,
): Promise<
  Array<{
    id: string;
    amount: { toString(): string };
    incomeType: string;
    incomeDate: Date;
    description: string | null;
  }>
> {
  const { otherIncome } = getFinanceDelegates();
  if (!otherIncome) {
    console.error("[finance] otherIncome delegate missing —", FINANCE_SCHEMA_DRIFT_HINT);
    return [];
  }

  try {
    const rows = await otherIncome.findMany({
      where: {
        ...otherIncomeWhere(scope),
        incomeDate: { gte: start, lte: end },
      },
      select: { id: true, amount: true, incomeType: true, incomeDate: true, description: true },
    });
    return rows.map((row) => ({
      ...row,
      description: row.description ?? null,
    }));
  } catch (error) {
    if (isFinanceSchemaDriftError(error)) {
      console.error("[finance] other_incomes query failed:", error);
      return [];
    }
    throw error;
  }
}
