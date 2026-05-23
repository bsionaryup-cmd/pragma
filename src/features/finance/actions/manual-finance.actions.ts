"use server";

import { revalidatePath } from "next/cache";
import { ManualPaymentMethod } from "@prisma/client";
import { assertBillingUnlocked } from "@/lib/billing/billing-guard";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  assertFinanceDelegates,
  isFinanceSchemaDriftError,
} from "@/services/finance/finance-prisma-guard";
import { dateKeyToPrismaDate } from "@/lib/dates";
import { resolveFinanceAttachmentUrl } from "@/lib/finance/attachment";

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
