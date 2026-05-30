"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createManualPaymentLinkAction } from "@/features/payments/actions/guest-payment.actions";
import { Button } from "@/components/ui/button";

export const PAYMENT_LINK_CATEGORIES = [
  { value: "MANUAL_OPERATIONAL", label: "Cobro operativo" },
  { value: "DAMAGE_FEE", label: "Daños" },
  { value: "CLEANING_FEE", label: "Limpieza" },
  { value: "LATE_CHECKOUT", label: "Salida tardía" },
  { value: "EXTRA_SERVICES", label: "Servicios extra" },
  { value: "DEPOSIT", label: "Depósito" },
] as const;

export type PaymentLinkCategory = (typeof PAYMENT_LINK_CATEGORIES)[number]["value"];

export function paymentLinkCategoryLabel(category: string): string {
  return (
    PAYMENT_LINK_CATEGORIES.find((item) => item.value === category)?.label ?? category
  );
}

export function PaymentLinkCreateForm() {
  const [pending, startTransition] = useTransition();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<PaymentLinkCategory>("MANUAL_OPERATIONAL");

  function submit(issue: boolean) {
    const parsed = Number(amount.replace(/,/g, ""));
    if (!description.trim() || !parsed || parsed <= 0) {
      toast.error("Completa descripción y monto válido");
      return;
    }
    startTransition(async () => {
      const result = await createManualPaymentLinkAction({
        category,
        description: description.trim(),
        amount: parsed,
        issue,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(issue ? "Enlace listo para compartir" : "Borrador guardado");
      setDescription("");
      setAmount("");
    });
  }

  return (
    <div className="border-b border-border px-4 py-4 sm:px-5">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Nuevo enlace
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.6fr)_auto] lg:items-end">
        <label className="block sm:col-span-2 lg:col-span-1">
          <span className="sr-only">Descripción</span>
          <input
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="Descripción del cobro"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="sr-only">Categoría</span>
          <select
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            value={category}
            onChange={(e) => setCategory(e.target.value as PaymentLinkCategory)}
          >
            {PAYMENT_LINK_CATEGORIES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="sr-only">Monto</span>
          <input
            type="number"
            min={1}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm tabular-nums"
            placeholder="Monto COP"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-1 lg:justify-end">
          <Button
            type="button"
            variant="brand"
            size="sm"
            disabled={pending}
            onClick={() => submit(true)}
          >
            Crear enlace
          </Button>
          <button
            type="button"
            className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            disabled={pending}
            onClick={() => submit(false)}
          >
            Guardar borrador
          </button>
        </div>
      </div>
    </div>
  );
}
