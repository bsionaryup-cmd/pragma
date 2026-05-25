"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type PaymentChargeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  currency?: string;
  maxAmount?: number;
  defaultAmount?: number;
  confirmLabel?: string;
  pending?: boolean;
  onConfirm: (amount: number) => void;
};

export function PaymentChargeDialog({
  open,
  onOpenChange,
  title,
  description,
  currency = "COP",
  maxAmount,
  defaultAmount,
  confirmLabel = "Generar enlace",
  pending = false,
  onConfirm,
}: PaymentChargeDialogProps) {
  const [amount, setAmount] = useState(
    defaultAmount != null ? String(defaultAmount) : "",
  );

  function handleConfirm() {
    const parsed = Number(amount.replace(/,/g, ""));
    if (!parsed || parsed <= 0) return;
    if (maxAmount != null && parsed > maxAmount + 0.009) return;
    onConfirm(parsed);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">Monto ({currency})</span>
          <input
            type="number"
            min={1}
            max={maxAmount}
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={maxAmount ? `Máx. ${maxAmount.toLocaleString()}` : "0"}
          />
        </label>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="brand"
            disabled={pending || !amount}
            onClick={handleConfirm}
          >
            {pending ? "Procesando…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
