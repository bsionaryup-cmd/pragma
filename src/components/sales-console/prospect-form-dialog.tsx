"use client";

import { useState, useTransition } from "react";
import {
  createProspectAction,
  updateProspectAction,
} from "@/features/sales-console/actions/prospect.actions";
import {
  PROSPECT_PIPELINE_STATUSES,
  PROSPECT_SEGMENTS,
  PROSPECT_SOURCES,
  emptyProspectFormValues,
  formatProspectSegment,
  formatProspectSource,
  formatProspectStatus,
  prospectToFormValues,
  type ProspectFormValues,
  type ProspectRow,
} from "@/features/sales-console/types/prospect";
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
import { toast } from "sonner";

type ProspectFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  prospect: ProspectRow | null;
  onSuccess: () => void;
};

export function ProspectFormDialog({
  open,
  onOpenChange,
  mode,
  prospect,
  onSuccess,
}: ProspectFormDialogProps) {
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<ProspectFormValues>(() =>
    mode === "edit" && prospect
      ? prospectToFormValues(prospect)
      : emptyProspectFormValues(),
  );

  function updateField<K extends keyof ProspectFormValues>(
    key: K,
    value: ProspectFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const payload = {
        companyName: values.companyName,
        phone: values.phone || null,
        website: values.website || null,
        instagram: values.instagram || null,
        city: values.city || null,
        segment: values.segment,
        source: values.source,
        notes: values.notes || null,
        ...(mode === "edit" ? { status: values.status } : {}),
      };

      const result =
        mode === "create"
          ? await createProspectAction(payload)
          : await updateProspectAction({ id: prospect!.id, ...payload });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success(mode === "create" ? "Prospecto creado" : "Prospecto actualizado");
      onOpenChange(false);
      onSuccess();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Nuevo prospecto" : "Editar prospecto"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Entrada manual · el estado queda en Nuevo hasta que lo cambies en el pipeline."
              : "Actualiza los datos y el estado del prospecto."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="prospect-company">Nombre de empresa *</Label>
            <Input
              id="prospect-company"
              value={values.companyName}
              onChange={(event) => updateField("companyName", event.target.value)}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="prospect-phone">Teléfono</Label>
              <Input
                id="prospect-phone"
                value={values.phone}
                onChange={(event) => updateField("phone", event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prospect-city">Ciudad</Label>
              <Input
                id="prospect-city"
                value={values.city}
                onChange={(event) => updateField("city", event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="prospect-website">Sitio web</Label>
              <Input
                id="prospect-website"
                value={values.website}
                onChange={(event) => updateField("website", event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prospect-instagram">Instagram</Label>
              <Input
                id="prospect-instagram"
                value={values.instagram}
                onChange={(event) => updateField("instagram", event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="prospect-segment">Segmento</Label>
              <select
                id="prospect-segment"
                value={values.segment}
                onChange={(event) =>
                  updateField("segment", event.target.value as ProspectFormValues["segment"])
                }
                className="h-10 w-full rounded-xl border border-input bg-white px-3 text-sm dark:bg-card"
              >
                {PROSPECT_SEGMENTS.map((segment) => (
                  <option key={segment} value={segment}>
                    {formatProspectSegment(segment)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prospect-source">Fuente</Label>
              <select
                id="prospect-source"
                value={values.source}
                onChange={(event) =>
                  updateField("source", event.target.value as ProspectFormValues["source"])
                }
                className="h-10 w-full rounded-xl border border-input bg-white px-3 text-sm dark:bg-card"
              >
                {PROSPECT_SOURCES.map((source) => (
                  <option key={source} value={source}>
                    {formatProspectSource(source)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {mode === "edit" ? (
            <div className="space-y-1.5">
              <Label htmlFor="prospect-status">Estado</Label>
              <select
                id="prospect-status"
                value={values.status}
                onChange={(event) =>
                  updateField("status", event.target.value as ProspectFormValues["status"])
                }
                className="h-10 w-full rounded-xl border border-input bg-white px-3 text-sm dark:bg-card"
              >
                {PROSPECT_PIPELINE_STATUSES.map((option) => (
                  <option key={option} value={option}>
                    {formatProspectStatus(option)}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="prospect-notes">Notas</Label>
            <textarea
              id="prospect-notes"
              value={values.notes}
              onChange={(event) => updateField("notes", event.target.value)}
              rows={3}
              className="w-full rounded-xl border border-input bg-white px-3 py-2 text-sm dark:bg-card"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : mode === "create" ? "Crear" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
