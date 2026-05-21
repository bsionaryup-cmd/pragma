"use server";

import { revalidatePath } from "next/cache";
import { ManualPaymentMethod } from "@prisma/client";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateKeyToPrismaDate } from "@/lib/dates";

export async function createManualExpenseAction(formData: FormData) {
  const auth = await requirePermission("finance:write");
  const amount = Number(formData.get("amount"));
  const category = String(formData.get("category") ?? "").trim();
  const expenseDate = String(formData.get("expenseDate") ?? "").trim();
  const paymentMethod = String(
    formData.get("paymentMethod") ?? "CASH",
  ) as ManualPaymentMethod;
  const description = String(formData.get("description") ?? "").trim();

  if (!category || !expenseDate || !Number.isFinite(amount) || amount <= 0) {
    throw new Error("Completa categoría, monto y fecha");
  }

  await db.manualExpense.create({
    data: {
      createdById: auth.dbUserId,
      category,
      amount,
      paymentMethod,
      expenseDate: dateKeyToPrismaDate(expenseDate),
      description: description || null,
      attachmentUrl: String(formData.get("attachmentUrl") ?? "").trim() || null,
    },
  });

  revalidatePath("/finance");
}

export async function createOtherIncomeAction(formData: FormData) {
  const auth = await requirePermission("finance:write");
  const amount = Number(formData.get("amount"));
  const incomeType = String(formData.get("incomeType") ?? "").trim();
  const incomeDate = String(formData.get("incomeDate") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!incomeType || !incomeDate || !Number.isFinite(amount) || amount <= 0) {
    throw new Error("Completa tipo, monto y fecha");
  }

  await db.otherIncome.create({
    data: {
      createdById: auth.dbUserId,
      amount,
      incomeType,
      incomeDate: dateKeyToPrismaDate(incomeDate),
      description: description || null,
    },
  });

  revalidatePath("/finance");
}
