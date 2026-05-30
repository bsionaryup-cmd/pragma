"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { FINANCE_DELETE_CONFIRM_MESSAGE } from "@/lib/finance/manual-finance-messages";
import {
  softDeleteManualExpenseAction,
  softDeleteOtherIncomeAction,
  updateManualExpenseAction,
  updateOtherIncomeAction,
} from "@/features/finance/actions/manual-finance.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ManualPaymentMethod } from "@prisma/client";

type ManualFinanceRowActionsProps = {
  kind: "expense" | "income";
  id: string;
  amount: number;
  date: string;
  label: string;
  paymentMethod?: ManualPaymentMethod;
};

export function ManualFinanceRowActions({
  kind,
  id,
  amount,
  date,
  label,
  paymentMethod = "CASH",
}: ManualFinanceRowActionsProps) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [draftAmount, setDraftAmount] = useState(String(amount));
  const [draftDate, setDraftDate] = useState(date.slice(0, 10));
  const [draftLabel, setDraftLabel] = useState(label);

  function onDelete() {
    if (!window.confirm(FINANCE_DELETE_CONFIRM_MESSAGE)) return;
    startTransition(async () => {
      const result =
        kind === "expense"
          ? await softDeleteManualExpenseAction(id)
          : await softDeleteOtherIncomeAction(id);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  function onSave() {
    startTransition(async () => {
      const result =
        kind === "expense"
          ? await updateManualExpenseAction({
              id,
              amount: draftAmount,
              category: draftLabel,
              expenseDate: draftDate,
              paymentMethod,
              description: draftLabel,
            })
          : await updateOtherIncomeAction({
              id,
              amount: draftAmount,
              incomeDate: draftDate,
              description: draftLabel,
            });
      if (result.ok) {
        toast.success(result.message);
        setEditing(false);
      } else {
        toast.error(result.message);
      }
    });
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-1.5 py-1">
        <Input
          value={draftLabel}
          onChange={(e) => setDraftLabel(e.target.value)}
          className="h-7 text-xs"
          disabled={pending}
        />
        <div className="flex gap-1">
          <Input
            type="date"
            value={draftDate}
            onChange={(e) => setDraftDate(e.target.value)}
            className="h-7 text-xs"
            disabled={pending}
          />
          <Input
            inputMode="numeric"
            value={draftAmount}
            onChange={(e) => setDraftAmount(e.target.value)}
            className="h-7 w-20 text-xs"
            disabled={pending}
          />
        </div>
        <div className="flex gap-1">
          <Button size="sm" className="h-7 px-2 text-xs" disabled={pending} onClick={onSave}>
            Guardar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            disabled={pending}
            onClick={() => setEditing(false)}
          >
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        disabled={pending}
        onClick={() => setEditing(true)}
        aria-label="Editar"
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
        disabled={pending}
        onClick={onDelete}
        aria-label="Eliminar"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
