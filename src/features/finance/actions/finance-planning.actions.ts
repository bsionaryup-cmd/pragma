"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertBillingUnlocked } from "@/lib/billing/billing-guard";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";
import {
  serializeFinancePlanningSettings,
} from "@/services/finance/finance-planning.service";

const fixedExpenseSchema = z.object({
  name: z.string().trim().min(1).max(120),
  amount: z.number().finite().min(0),
});

const variableExpenseSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.enum(["percent", "fixed_per_booking"]),
  value: z.number().finite().min(0),
});

const planningSettingsSchema = z.object({
  propertyId: z.string().trim().min(1).nullable().optional(),
  monthlyProfitGoal: z.number().finite().min(0),
  fixedExpenses: z.array(fixedExpenseSchema).max(20),
  variableExpenses: z.array(variableExpenseSchema).max(20),
});

export async function upsertFinancePlanningSettingsAction(input: unknown) {
  await requirePermission("finance:write");
  await assertBillingUnlocked();
  const scope = await requireTenantDataScope();
  if (!scope.organizationId) {
    return { success: false as const, error: "Organización no disponible." };
  }

  const parsed = planningSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: "Revisa la configuración ingresada." };
  }

  const settings = serializeFinancePlanningSettings(parsed.data);

  if (settings.propertyId) {
    const property = await db.property.findFirst({
      where: {
        id: settings.propertyId,
        organizationId: scope.organizationId,
      },
      select: { id: true },
    });
    if (!property) {
      return { success: false as const, error: "Propiedad no encontrada." };
    }
  }

  await db.financialPlanningSetting.upsert({
    where: { organizationId: scope.organizationId },
    create: {
      organizationId: scope.organizationId,
      propertyId: settings.propertyId ?? null,
      fixedExpenses: settings.fixedExpenses,
      variableExpenses: settings.variableExpenses,
      monthlyProfitGoal: settings.monthlyProfitGoal,
    },
    update: {
      propertyId: settings.propertyId ?? null,
      fixedExpenses: settings.fixedExpenses,
      variableExpenses: settings.variableExpenses,
      monthlyProfitGoal: settings.monthlyProfitGoal,
    },
  });

  revalidatePath("/finance");
  revalidatePath("/panel");

  return { success: true as const };
}

export async function addRepeatedExpenseAsFixedAction(input: {
  name: string;
  amount: number;
}) {
  await requirePermission("finance:write");
  await assertBillingUnlocked();
  const scope = await requireTenantDataScope();
  if (!scope.organizationId) {
    return { success: false as const, error: "Organización no disponible." };
  }

  const name = input.name.trim();
  const amount = Math.round(Number(input.amount));
  if (!name || !Number.isFinite(amount) || amount <= 0) {
    return { success: false as const, error: "Gasto inválido." };
  }

  const existing = await db.financialPlanningSetting.findUnique({
    where: { organizationId: scope.organizationId },
    select: {
      propertyId: true,
      fixedExpenses: true,
      variableExpenses: true,
      monthlyProfitGoal: true,
    },
  });

  const fixedExpenses = Array.isArray(existing?.fixedExpenses)
    ? [...(existing.fixedExpenses as { name: string; amount: number }[])]
    : [];

  if (
    fixedExpenses.some(
      (row) =>
        row.name.trim().toLowerCase() === name.toLowerCase() &&
        Math.round(Number(row.amount)) === amount,
    )
  ) {
    return { success: true as const };
  }

  fixedExpenses.push({ name, amount });

  await db.financialPlanningSetting.upsert({
    where: { organizationId: scope.organizationId },
    create: {
      organizationId: scope.organizationId,
      propertyId: existing?.propertyId ?? null,
      fixedExpenses,
      variableExpenses: Array.isArray(existing?.variableExpenses)
        ? existing.variableExpenses
        : [],
      monthlyProfitGoal: existing?.monthlyProfitGoal ?? 0,
    },
    update: {
      fixedExpenses,
    },
  });

  revalidatePath("/finance");
  return { success: true as const };
}
