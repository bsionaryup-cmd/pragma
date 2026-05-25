"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CalendarViewSettings } from "@/features/calendar/lib/calendar-view-settings";
import { cn } from "@/lib/utils";

type CalendarViewSettingsDialogProps = {
  open: boolean;
  settings: CalendarViewSettings;
  onClose: () => void;
  onSave: (settings: CalendarViewSettings) => void;
};

function SettingsToggle({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <span className="text-sm text-[#111111]">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "relative inline-flex h-[26px] w-[46px] shrink-0 rounded-full transition-colors",
          checked ? "bg-[#111111]" : "bg-[#e8e8e8]",
        )}
      >
        <span
          className={cn(
            "pointer-events-none absolute top-[3px] size-5 rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-[22px]" : "translate-x-[3px]",
          )}
        />
      </button>
    </div>
  );
}

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-[#ebebeb] py-1 last:border-b-0">
      <h3 className="pt-4 pb-1 text-sm font-bold text-[#111111]">{title}</h3>
      {children}
    </section>
  );
}

export function CalendarViewSettingsDialog({
  open,
  settings,
  onClose,
  onSave,
}: CalendarViewSettingsDialogProps) {
  const [draft, setDraft] = useState<CalendarViewSettings>(settings);

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => setDraft(settings));
  }, [open, settings]);

  function updateDraft<K extends keyof CalendarViewSettings>(
    key: K,
    value: CalendarViewSettings[K],
  ) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    onSave(draft);
    onClose();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <DialogContent
        showCloseButton
        className="gap-0 overflow-hidden rounded-xl border-[#e5e5e5] p-0 sm:max-w-[420px]"
      >
        <DialogTitle className="border-b border-[#ebebeb] px-6 py-5 text-left text-base font-bold text-[#111111]">
          Personalizar vista del calendario
        </DialogTitle>

        <div className="max-h-[min(70vh,520px)] overflow-y-auto px-6 pb-2">
          <SettingsSection title="Detalles del alojamiento">
            <SettingsToggle
              label="Mostrar imagen"
              checked={draft.showImage}
              onCheckedChange={(checked) => updateDraft("showImage", checked)}
            />
            <SettingsToggle
              label="Mostrar nombre interno"
              checked={draft.showInternalName}
              onCheckedChange={(checked) =>
                updateDraft("showInternalName", checked)
              }
            />
            <SettingsToggle
              label="Mostrar número de identificación"
              checked={draft.showIdentificationNumber}
              onCheckedChange={(checked) =>
                updateDraft("showIdentificationNumber", checked)
              }
            />
          </SettingsSection>

          <SettingsSection title="Detalles por noche">
            <SettingsToggle
              label="Mostrar precio"
              checked={draft.showPrice}
              onCheckedChange={(checked) => updateDraft("showPrice", checked)}
            />
            <SettingsToggle
              label="Mostrar estancia mínima"
              checked={draft.showMinimumStay}
              onCheckedChange={(checked) =>
                updateDraft("showMinimumStay", checked)
              }
            />
          </SettingsSection>

          <SettingsSection title="Primer día de la semana">
            <div className="flex items-center gap-2 py-3.5">
              <button
                type="button"
                onClick={() => updateDraft("weekStartsOn", "monday")}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-sm transition-colors",
                  draft.weekStartsOn === "monday"
                    ? "border-[#111111] bg-[#111111] text-white"
                    : "border-[#e5e5e5] bg-white text-[#111111] hover:bg-[#f7f7f7]",
                )}
              >
                Lunes
              </button>
              <button
                type="button"
                onClick={() => updateDraft("weekStartsOn", "sunday")}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-sm transition-colors",
                  draft.weekStartsOn === "sunday"
                    ? "border-[#111111] bg-[#111111] text-white"
                    : "border-[#e5e5e5] bg-white text-[#111111] hover:bg-[#f7f7f7]",
                )}
              >
                Domingo
              </button>
            </div>
          </SettingsSection>
        </div>

        <div className="flex items-center justify-between border-t border-[#ebebeb] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium text-[#111111] underline-offset-4 hover:underline"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-full bg-[#111111] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#111111]/90"
          >
            Guardar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
