"use client";

import { useState, useTransition } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import {
  createMobilityAllyAction,
  updateMobilityAllyAction,
} from "@/features/qr-mobility/actions/ally.actions";
import {
  MOBILITY_ALLY_TYPES,
  MOBILITY_RECORD_STATUSES,
  allyToFormValues,
  emptyMobilityAllyFormValues,
  formatMobilityAllyType,
  formatMobilityRecordStatus,
  type MobilityAllyFormValues,
  type SerializedMobilityAllyRow,
} from "@/features/qr-mobility/types/ally";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { copyTextToClipboard } from "@/lib/copy-to-clipboard";

type MobilityAllyFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  ally: SerializedMobilityAllyRow | null;
  onSuccess: () => void;
};

export function MobilityAllyFormDialog({
  open,
  onOpenChange,
  mode,
  ally,
  onSuccess,
}: MobilityAllyFormDialogProps) {
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<MobilityAllyFormValues>(emptyMobilityAllyFormValues);

  function handleOpenChange(next: boolean) {
    if (next) {
      setValues(
        mode === "edit" && ally ? allyToFormValues(ally) : emptyMobilityAllyFormValues(),
      );
    }
    onOpenChange(next);
  }

  function updateField<K extends keyof MobilityAllyFormValues>(
    key: K,
    value: MobilityAllyFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const commission =
        values.commissionPercent.trim() === ""
          ? null
          : Number.parseFloat(values.commissionPercent);

      const payload = {
        name: values.name,
        type: values.type,
        company: values.company || null,
        phone: values.phone || null,
        email: values.email || null,
        commissionPercent: commission,
        status: values.status,
        notes: values.notes || null,
      };

      const result =
        mode === "create"
          ? await createMobilityAllyAction(payload)
          : await updateMobilityAllyAction({ ...payload, id: ally!.id });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success(mode === "create" ? "Aliado creado" : "Aliado actualizado");
      handleOpenChange(false);
      onSuccess();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Nuevo aliado" : "Editar aliado"}</DialogTitle>
          <DialogDescription>
            Registra un aliado de movilidad con código y QR únicos.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ally-name">Nombre *</Label>
            <Input
              id="ally-name"
              value={values.name}
              onChange={(event) => updateField("name", event.target.value)}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ally-type">Tipo *</Label>
              <select
                id="ally-type"
                value={values.type}
                onChange={(event) =>
                  updateField("type", event.target.value as MobilityAllyFormValues["type"])
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {MOBILITY_ALLY_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {formatMobilityAllyType(type)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ally-status">Estado</Label>
              <select
                id="ally-status"
                value={values.status}
                onChange={(event) =>
                  updateField("status", event.target.value as MobilityAllyFormValues["status"])
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                disabled={mode === "create"}
              >
                {MOBILITY_RECORD_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {formatMobilityRecordStatus(status)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ally-company">Empresa</Label>
            <Input
              id="ally-company"
              value={values.company}
              onChange={(event) => updateField("company", event.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ally-phone">Teléfono</Label>
              <Input
                id="ally-phone"
                value={values.phone}
                onChange={(event) => updateField("phone", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ally-email">Correo</Label>
              <Input
                id="ally-email"
                type="email"
                value={values.email}
                onChange={(event) => updateField("email", event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ally-commission">Comisión (%)</Label>
            <Input
              id="ally-commission"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={values.commissionPercent}
              onChange={(event) => updateField("commissionPercent", event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ally-notes">Observaciones</Label>
            <textarea
              id="ally-notes"
              value={values.notes}
              onChange={(event) => updateField("notes", event.target.value)}
              rows={3}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          {mode === "edit" && ally ? (
            <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm">
              <p className="font-medium">QR y link</p>
              <p className="mt-1 break-all text-muted-foreground">{ally.publicUrl}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void copyTextToClipboard("Link", ally.publicUrl)}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copiar link
                </Button>
              </div>
              {ally.qrImageDataUrl ? (
                <img
                  src={ally.qrImageDataUrl}
                  alt={`QR de ${ally.name}`}
                  className="mt-4 h-32 w-32 rounded-lg border border-border bg-white p-2"
                />
              ) : null}
              <p className="mt-2 text-xs text-muted-foreground">Código: {ally.code}</p>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : mode === "create" ? "Crear aliado" : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
