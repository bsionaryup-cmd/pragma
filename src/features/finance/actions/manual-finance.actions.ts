"use server";

import { revalidatePath } from "next/cache";
import { ManualPaymentMethod } from "@prisma/client";
import { assertBillingUnlocked } from "@/lib/billing/billing-guard";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateKeyToPrismaDate } from "@/lib/dates";
import { resolveFinanceAttachmentUrl } from "@/lib/finance/attachment";
import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";
import {
  manualExpenseWhere,
  otherIncomeWhere,
} from "@/lib/platform/tenant-data-scope";
import {
  assertFinanceDelegates,
  isFinanceSchemaDriftError,
} from "@/services/finance/finance-prisma-guard";

export async function createManualExpenseAction(formData: FormData) {
  const auth = await requirePermission("finance:write");
  await assertBillingUnlocked();
  const amount = Number(formData.get("amount"));
  const category = String(formData.get("category") ?? "").trim();
  const expenseDate = String(formData.get("expenseDate") ?? "").trim();
  const paymentMethod = String(
    formData.get("paymentMethod") ?? "CASH",
  ) as ManualPaymentMethod;
  const description = String(formData.get("description") ?? "").trim();

  if (!category || !expenseDate || !Number.isFinite(amount) || amount <= 0) {
    throw new Error("Completa descripción, categoría, monto y fecha");
  }

  assertFinanceDelegates();

  let attachmentUrl: string | null = null;
  try {
    attachmentUrl = await resolveFinanceAttachmentUrl(formData);
  } catch (error) {
    throw error instanceof Error ? error : new Error("No se pudo adjuntar el archivo");
  }

  try {
    await db.manualExpense.create({
      data: {
        createdById: auth.dbUserId,
        category,
        amount,
        paymentMethod,
        expenseDate: dateKeyToPrismaDate(expenseDate),
        description: description || null,
        attachmentUrl,
      },
    });
  } catch (error) {
    if (isFinanceSchemaDriftError(error)) {
      throw new Error(
        "Tabla de egresos no disponible. Ejecuta db:migrate:deploy.",
      );
    }
    throw error;
  }

  revalidatePath("/finance");
  revalidatePath("/panel");
}

export async function updateManualExpenseAction(input: {
  id: string;
  amount: string;
  category: string;
  expenseDate: string;
  paymentMethod: ManualPaymentMethod;
  description?: string;
}) {
  const auth = await requirePermission("finance:write");
  await assertBillingUnlocked();
  const scope = await requireTenantDataScope();
  const amount = Number(input.amount);
  const category = input.category.trim();
  const expenseDate = input.expenseDate.trim();
  const description = input.description?.trim() ?? "";

  if (!category || !expenseDate || !Number.isFinite(amount) || amount <= 0) {
    return { ok: false, message: "Completa categoría, monto y fecha" };
  }

  assertFinanceDelegates();

  const existing = await db.manualExpense.findFirst({
    where: { id: input.id, ...manualExpenseWhere(scope) },
    select: { id: true },
  });
  if (!existing) {
    return { ok: false, message: "Egreso no encontrado" };
  }

  try {
    await db.manualExpense.update({
      where: { id: input.id },
      data: {
        category,
        amount,
        paymentMethod: input.paymentMethod,
        expenseDate: dateKeyToPrismaDate(expenseDate),
        description: description || null,
      },
    });
  } catch (error) {
    if (isFinanceSchemaDriftError(error)) {
      return { ok: false, message: "Tabla de egresos no disponible." };
    }
    throw error;
  }

  revalidatePath("/finance");
  revalidatePath("/panel");
  return { ok: true, message: "Egreso actualizado" };
}

export async function softDeleteManualExpenseAction(id: string) {
  const auth = await requirePermission("finance:write");
  await assertBillingUnlocked();
  const scope = await requireTenantDataScope();

  assertFinanceDelegates();

  const existing = await db.manualExpense.findFirst({
    where: { id, ...manualExpenseWhere(scope) },
    select: { id: true },
  });
  if (!existing) {
    return { ok: false, message: "Egreso no encontrado" };
  }

  try {
    await db.manualExpense.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedById: auth.dbUserId,
      },
    });
  } catch (error) {
    if (isFinanceSchemaDriftError(error)) {
      return { ok: false, message: "Tabla de egresos no disponible." };
    }
    throw error;
  }

  revalidatePath("/finance");
  revalidatePath("/panel");
  return { ok: true, message: "Egreso eliminado de la vista activa" };
}

export async function createOtherIncomeAction(formData: FormData) {
  const auth = await requirePermission("finance:write");
  await assertBillingUnlocked();
  const amount = Number(formData.get("amount"));
  const incomeDate = String(formData.get("incomeDate") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!description || !incomeDate || !Number.isFinite(amount) || amount <= 0) {
    throw new Error("Completa descripción, monto y fecha");
  }

  assertFinanceDelegates();

  try {
    await db.otherIncome.create({
      data: {
        createdById: auth.dbUserId,
        amount,
        incomeType: description.slice(0, 80),
        incomeDate: dateKeyToPrismaDate(incomeDate),
        description,
      },
    });
  } catch (error) {
    if (isFinanceSchemaDriftError(error)) {
      throw new Error(
        "Tabla de ingresos no disponible. Ejecuta db:migrate:deploy.",
      );
    }
    throw error;
  }

  revalidatePath("/finance");
  revalidatePath("/panel");
}

export async function updateOtherIncomeAction(input: {
  id: string;
  amount: string;
  incomeDate: string;
  description: string;
}) {
  const auth = await requirePermission("finance:write");
  await assertBillingUnlocked();
  const scope = await requireTenantDataScope();
  const amount = Number(input.amount);
  const incomeDate = input.incomeDate.trim();
  const description = input.description.trim();

  if (!description || !incomeDate || !Number.isFinite(amount) || amount <= 0) {
    return { ok: false, message: "Completa descripción, monto y fecha" };
  }

  assertFinanceDelegates();

  const existing = await db.otherIncome.findFirst({
    where: { id: input.id, ...otherIncomeWhere(scope) },
    select: { id: true },
  });
  if (!existing) {
    return { ok: false, message: "Ingreso no encontrado" };
  }

  try {
    await db.otherIncome.update({
      where: { id: input.id },
      data: {
        amount,
        incomeType: description.slice(0, 80),
        incomeDate: dateKeyToPrismaDate(incomeDate),
        description,
      },
    });
  } catch (error) {
    if (isFinanceSchemaDriftError(error)) {
      return { ok: false, message: "Tabla de ingresos no disponible." };
    }
    throw error;
  }

  revalidatePath("/finance");
  revalidatePath("/panel");
  return { ok: true, message: "Ingreso actualizado" };
}

export async function softDeleteOtherIncomeAction(id: string) {
  const auth = await requirePermission("finance:write");
  await assertBillingUnlocked();
  const scope = await requireTenantDataScope();

  assertFinanceDelegates();

  const existing = await db.otherIncome.findFirst({
    where: { id, ...otherIncomeWhere(scope) },
    select: { id: true },
  });
  if (!existing) {
    return { ok: false, message: "Ingreso no encontrado" };
  }

  try {
    await db.otherIncome.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedById: auth.dbUserId,
      },
    });
  } catch (error) {
    if (isFinanceSchemaDriftError(error)) {
      return { ok: false, message: "Tabla de ingresos no disponible." };
    }
    throw error;
  }

  revalidatePath("/finance");
  revalidatePath("/panel");
  return { ok: true, message: "Ingreso eliminado de la vista activa" };
}
