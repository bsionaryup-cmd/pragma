"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, Receipt, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import {
  createManualExpenseAction,
  createOtherIncomeAction,
} from "@/features/finance/actions/manual-finance.actions";
import { FinanceDateField } from "@/components/finance/finance-date-field";
import { useI18n } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionCard } from "@/components/ui/section-card";

function todayDateInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function AttachmentField({
  id,
  disabled,
}: {
  id: string;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <div className="space-y-2 sm:col-span-2">
      <Label htmlFor={`${id}-file`}>{t("finance.manual.attachment")}</Label>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className="gap-2 shrink-0"
          onClick={() => inputRef.current?.click()}
        >
          <Paperclip className="h-3.5 w-3.5" />
          {fileName ? t("finance.manual.changeFile") : t("finance.manual.addFile")}
        </Button>
        <input
          ref={inputRef}
          id={`${id}-file`}
          name="attachmentFile"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
          className="sr-only"
          disabled={disabled}
          onChange={(event) => {
            const file = event.target.files?.[0];
            setFileName(file?.name ?? null);
          }}
        />
        {fileName ? (
          <span className="truncate text-xs text-muted-foreground">{fileName}</span>
        ) : (
          <span className="text-xs text-muted-foreground">
            {t("finance.manual.attachmentHint")}
          </span>
        )}
      </div>
      <Input
        name="attachmentUrl"
        type="url"
        placeholder={t("finance.manual.attachmentUrlPlaceholder")}
        disabled={disabled}
        className="text-sm"
      />
    </div>
  );
}

export function ExpenseSubmodule() {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const today = todayDateInputValue();

  return (
    <SectionCard
      title={t("finance.modules.expenses.title")}
      description={t("finance.modules.expenses.description")}
    >
      <form
        className="grid gap-4 p-4 sm:grid-cols-2"
        encType="multipart/form-data"
        action={(fd) =>
          startTransition(async () => {
            try {
              await createManualExpenseAction(fd);
              toast.success(t("finance.manual.expenseSaved"));
              router.refresh();
            } catch (e) {
              toast.error(e instanceof Error ? e.message : t("common.loading"));
            }
          })
        }
      >
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="expense-description">{t("finance.manual.description")}</Label>
          <Input
            id="expense-description"
            name="description"
            required
            placeholder={t("finance.manual.expenseDescriptionPlaceholder")}
            disabled={pending}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="expense-category">{t("finance.flows.category")}</Label>
          <Input
            id="expense-category"
            name="category"
            required
            placeholder={t("finance.manual.categoryPlaceholder")}
            disabled={pending}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="expense-amount">{t("finance.manual.amountCop")}</Label>
          <Input
            id="expense-amount"
            name="amount"
            type="number"
            min="0"
            step="1"
            required
            disabled={pending}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="expense-method">{t("finance.manual.paymentMethod")}</Label>
          <select
            id="expense-method"
            name="paymentMethod"
            className="flex h-10 w-full rounded-xl border border-input bg-card px-3 text-sm"
            defaultValue="CASH"
            disabled={pending}
          >
            <option value="CASH">{t("finance.manual.methods.cash")}</option>
            <option value="TRANSFER">{t("finance.manual.methods.transfer")}</option>
            <option value="CARD">{t("finance.manual.methods.card")}</option>
            <option value="OTHER">{t("finance.manual.methods.other")}</option>
          </select>
        </div>
        <FinanceDateField
          id="expense-date"
          name="expenseDate"
          label={t("finance.flows.date")}
          defaultValue={today}
          required
          disabled={pending}
        />
        <AttachmentField id="expense" disabled={pending} />
        <Button type="submit" size="sm" disabled={pending} className="sm:col-span-2">
          <Receipt className="mr-2 h-4 w-4" />
          {t("finance.manual.saveExpense")}
        </Button>
      </form>
    </SectionCard>
  );
}

export function OtherIncomeSubmodule() {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const today = todayDateInputValue();

  return (
    <SectionCard
      title={t("finance.modules.otherIncome.title")}
      description={t("finance.modules.otherIncome.description")}
    >
      <form
        className="grid gap-4 p-4 sm:grid-cols-2"
        action={(fd) =>
          startTransition(async () => {
            try {
              await createOtherIncomeAction(fd);
              toast.success(t("finance.manual.incomeSaved"));
              router.refresh();
            } catch (e) {
              toast.error(e instanceof Error ? e.message : t("common.loading"));
            }
          })
        }
      >
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="income-description">{t("finance.manual.description")}</Label>
          <Input
            id="income-description"
            name="description"
            required
            placeholder={t("finance.manual.incomeDescriptionPlaceholder")}
            disabled={pending}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="income-amount">{t("finance.manual.amountCop")}</Label>
          <Input
            id="income-amount"
            name="amount"
            type="number"
            min="0"
            step="1"
            required
            disabled={pending}
          />
        </div>
        <FinanceDateField
          id="income-date"
          name="incomeDate"
          label={t("finance.flows.date")}
          defaultValue={today}
          required
          disabled={pending}
        />
        <Button type="submit" size="sm" disabled={pending} className="sm:col-span-2">
          <TrendingUp className="mr-2 h-4 w-4" />
          {t("finance.manual.saveIncome")}
        </Button>
      </form>
    </SectionCard>
  );
}

/** @deprecated Use ExpenseSubmodule / OtherIncomeSubmodule */
export function ManualFinanceForms() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ExpenseSubmodule />
      <OtherIncomeSubmodule />
    </div>
  );
}
