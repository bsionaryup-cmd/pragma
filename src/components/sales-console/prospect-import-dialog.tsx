"use client";

import { FileUp, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { importProspectsAction } from "@/features/sales-console/actions/prospect-import.actions";
import type { ProspectImportSourcePreset } from "@/modules/sales-console/import/prospect-import.types";
import { PROSPECT_IMPORT_MAX_ROWS } from "@/modules/sales-console/import/prospect-import.parse";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type ProspectImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

const SOURCE_PRESET_OPTIONS: Array<{ value: ProspectImportSourcePreset; label: string }> = [
  { value: "MANUAL", label: "Manual / lista propia" },
  { value: "GOOGLE_MAPS_MANUAL", label: "Google Maps (copiado manual)" },
  { value: "FREE_DIRECTORY", label: "Directorio gratuito" },
];

export function ProspectImportDialog({ open, onOpenChange, onSuccess }: ProspectImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [sourcePreset, setSourcePreset] = useState<ProspectImportSourcePreset>("MANUAL");
  const [pending, setPending] = useState(false);

  function resetForm() {
    setText("");
    setSourcePreset("MANUAL");
    setPending(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      resetForm();
    }
    onOpenChange(nextOpen);
  }

  async function handleCsvFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
      toast.error("Solo se admiten archivos .csv");
      event.target.value = "";
      return;
    }

    try {
      const content = await file.text();
      setText(content);
      toast.success("Archivo CSV cargado en el área de texto");
    } catch {
      toast.error("No se pudo leer el archivo CSV");
    } finally {
      event.target.value = "";
    }
  }

  async function handleImport(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);

    try {
      const result = await importProspectsAction({ text, sourcePreset });
      if (!result.success) {
        toast.error(result.error);
        return;
      }

      const skippedParts: string[] = [];
      if (result.skippedDuplicate > 0) {
        skippedParts.push(`${result.skippedDuplicate} duplicados`);
      }
      if (result.skippedInvalid > 0) {
        skippedParts.push(`${result.skippedInvalid} inválidos`);
      }
      const skippedText =
        skippedParts.length > 0 ? ` · Omitidos: ${skippedParts.join(", ")}` : "";

      toast.success(`Importados ${result.imported} prospectos${skippedText}`);
      onSuccess();
      handleOpenChange(false);
    } catch {
      toast.error("No fue posible importar los prospectos");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Importar prospectos</DialogTitle>
          <DialogDescription>
            Lista simple, CSV pegado, Excel tabulado o archivo .csv · máximo {PROSPECT_IMPORT_MAX_ROWS}{" "}
            empresas por importación
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleImport} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="import-source-preset">Origen de los datos</Label>
            <select
              id="import-source-preset"
              value={sourcePreset}
              onChange={(event) =>
                setSourcePreset(event.target.value as ProspectImportSourcePreset)
              }
              className="h-10 w-full rounded-xl border border-input bg-white px-3 text-sm dark:bg-card"
            >
              {SOURCE_PRESET_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="import-text">Contenido</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileUp className="h-3.5 w-3.5" />
                Subir CSV
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(event) => void handleCsvFile(event)}
              />
            </div>
            <textarea
              id="import-text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={10}
              placeholder={`Ejemplos:\n\nEmpresa A\nEmpresa B\n\n— o —\n\nEmpresa | Teléfono | Website\nAcme PM | 3001234567 | https://acme.com`}
              className="w-full rounded-xl border border-input bg-white px-3 py-2 font-mono text-xs leading-relaxed dark:bg-card"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || !text.trim()} className="gap-2">
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importando…
                </>
              ) : (
                "Importar"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
