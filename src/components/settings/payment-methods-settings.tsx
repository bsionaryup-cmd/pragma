"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  getPaymentMethodsSettingsAction,
  savePaymentMethodsSettingsAction,
} from "@/features/settings/actions/payment-methods.actions";
import type { OrganizationPaymentMethod } from "@/lib/payments/organization-payment-methods-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TYPE_LABELS: Record<OrganizationPaymentMethod["type"], string> = {
  payment_link: "Link de pago",
  cash: "Efectivo",
  bank_transfer: "Transferencia bancaria",
  other: "Otro",
};

type PaymentMethodsSettingsProps = {
  canManage: boolean;
};

function newBankMethod(): OrganizationPaymentMethod {
  return {
    id: crypto.randomUUID(),
    enabled: true,
    type: "bank_transfer",
    label: "",
    account_holder: "",
  };
}

export function PaymentMethodsSettings({ canManage }: PaymentMethodsSettingsProps) {
  const [pending, startTransition] = useTransition();
  const [methods, setMethods] = useState<OrganizationPaymentMethod[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    startTransition(async () => {
      const result = await getPaymentMethodsSettingsAction();
      if (result.success) {
        setMethods(result.methods);
      }
      setLoaded(true);
    });
  }, []);

  const bankMethods = methods.filter((method) => method.type === "bank_transfer");
  const baseMethods = methods.filter((method) => method.type !== "bank_transfer");

  function updateMethod(id: string, patch: Partial<OrganizationPaymentMethod>) {
    setMethods((current) =>
      current.map((method) => (method.id === id ? { ...method, ...patch } : method)),
    );
  }

  function removeMethod(id: string) {
    setMethods((current) => current.filter((method) => method.id !== id));
  }

  function save() {
    startTransition(async () => {
      const result = await savePaymentMethodsSettingsAction({ methods });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setMethods(result.methods);
      toast.success("Métodos de pago guardados");
    });
  }

  if (!loaded) {
    return <p className="text-sm text-muted-foreground">Cargando métodos…</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Configura cómo pueden pagar los huéspedes en reservas directas. Solo metadatos
        (sin credenciales bancarias).
      </p>

      <ul className="space-y-2">
        {baseMethods.map((method) => (
          <li
            key={method.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-border/80 px-3 py-2"
          >
            <div>
              <p className="text-sm font-medium">{TYPE_LABELS[method.type]}</p>
              <p className="text-xs text-muted-foreground">
                {method.type === "payment_link"
                  ? "Enlaces Wompi (flujo existente)"
                  : "Registro manual en la reserva"}
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={method.enabled}
                disabled={!canManage || pending}
                onChange={(event) =>
                  updateMethod(method.id, { enabled: event.target.checked })
                }
              />
              Habilitado
            </label>
          </li>
        ))}
      </ul>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label>Cuentas para transferencia</Label>
          {canManage ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              disabled={pending}
              onClick={() => setMethods((current) => [...current, newBankMethod()])}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Agregar cuenta
            </Button>
          ) : null}
        </div>

        {bankMethods.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin cuentas configuradas.</p>
        ) : (
          <ul className="space-y-2">
            {bankMethods.map((method) => (
              <li
                key={method.id}
                className="grid gap-2 rounded-lg border border-border/80 p-3 sm:grid-cols-[1fr_1fr_auto_auto]"
              >
                <div className="space-y-1">
                  <Label className="text-xs">Nombre / banco</Label>
                  <Input
                    value={method.label ?? ""}
                    disabled={!canManage || pending}
                    placeholder="Bancolombia Ahorros"
                    onChange={(event) =>
                      updateMethod(method.id, { label: event.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Titular</Label>
                  <Input
                    value={method.account_holder ?? ""}
                    disabled={!canManage || pending}
                    placeholder="Samuel"
                    onChange={(event) =>
                      updateMethod(method.id, { account_holder: event.target.value })
                    }
                  />
                </div>
                <label className="flex items-end gap-2 pb-2 text-xs">
                  <input
                    type="checkbox"
                    checked={method.enabled}
                    disabled={!canManage || pending}
                    onChange={(event) =>
                      updateMethod(method.id, { enabled: event.target.checked })
                    }
                  />
                  Activa
                </label>
                {canManage ? (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 self-end text-muted-foreground hover:text-danger"
                    disabled={pending}
                    onClick={() => removeMethod(method.id)}
                    aria-label="Eliminar cuenta"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {canManage ? (
        <Button type="button" disabled={pending} onClick={save}>
          {pending ? "Guardando…" : "Guardar métodos de pago"}
        </Button>
      ) : null}
    </div>
  );
}
