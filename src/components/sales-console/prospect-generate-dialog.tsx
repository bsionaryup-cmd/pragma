"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  importGeneratedProspectsAction,
  startProspectGenerationAction,
} from "@/features/sales-console/actions/prospect-generation.actions";
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

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 200;
const GENERATION_LIMITS = [25, 50, 100] as const;

type GenerationLimit = (typeof GENERATION_LIMITS)[number];

type DialogPhase = "form" | "running" | "done";

type ProspectGenerateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apifyConfigured: boolean;
  onSuccess: () => void;
};

export function ProspectGenerateDialog({
  open,
  onOpenChange,
  apifyConfigured,
  onSuccess,
}: ProspectGenerateDialogProps) {
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollAttemptsRef = useRef(0);

  const [phase, setPhase] = useState<DialogPhase>("form");
  const [searchQuery, setSearchQuery] = useState("");
  const [limit, setLimit] = useState<GenerationLimit>(50);
  const [resultSummary, setResultSummary] = useState<{
    imported: number;
    skippedInvalid: number;
    skippedDuplicate: number;
  } | null>(null);

  function clearPollTimeout() {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  }

  function resetDialog() {
    clearPollTimeout();
    pollAttemptsRef.current = 0;
    setPhase("form");
    setResultSummary(null);
  }

  useEffect(() => {
    return () => {
      clearPollTimeout();
    };
  }, []);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      resetDialog();
    }
    onOpenChange(nextOpen);
  }

  async function pollImport(runId: string) {
    pollAttemptsRef.current += 1;

    if (pollAttemptsRef.current > MAX_POLL_ATTEMPTS) {
      setPhase("form");
      toast.error("La generación expiró. Intenta de nuevo con un límite menor.");
      return;
    }

    const result = await importGeneratedProspectsAction(runId);

    if (!result.success) {
      setPhase("form");
      toast.error("error" in result ? result.error : "La generación de prospectos falló");
      return;
    }

    if (result.status === "RUNNING") {
      pollTimeoutRef.current = setTimeout(() => {
        void pollImport(runId);
      }, POLL_INTERVAL_MS);
      return;
    }

    setResultSummary({
      imported: result.imported,
      skippedInvalid: result.skippedInvalid,
      skippedDuplicate: result.skippedDuplicate,
    });
    setPhase("done");
    onSuccess();

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
  }

  async function handleGenerate(event: React.FormEvent) {
    event.preventDefault();

    const start = await startProspectGenerationAction({ searchQuery, limit });
    if (!start.success) {
      toast.error(start.error);
      return;
    }

    setPhase("running");
    pollAttemptsRef.current = 0;
    await pollImport(start.runId);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Generar prospectos</DialogTitle>
          <DialogDescription>
            Google Maps vía Apify · los prospectos importados quedan en estado Nuevo
          </DialogDescription>
        </DialogHeader>

        {!apifyConfigured ? (
          <p className="text-sm text-muted-foreground">
            Configura APIFY_API_TOKEN para habilitar la generación automática de prospectos.
          </p>
        ) : phase === "form" ? (
          <form onSubmit={handleGenerate} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="generate-search-query">Consulta de búsqueda</Label>
              <Input
                id="generate-search-query"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="administración de propiedades Medellín"
                required
                minLength={3}
                maxLength={200}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="generate-limit">Límite</Label>
              <select
                id="generate-limit"
                value={limit}
                onChange={(event) => setLimit(Number(event.target.value) as GenerationLimit)}
                className="h-10 w-full rounded-xl border border-input bg-white px-3 text-sm dark:bg-card"
              >
                {GENERATION_LIMITS.map((value) => (
                  <option key={value} value={value}>
                    {value} empresas
                  </option>
                ))}
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit">Generar</Button>
            </DialogFooter>
          </form>
        ) : phase === "running" ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-pragma-electric" />
            <p className="text-sm font-medium text-foreground">Extrayendo de Google Maps…</p>
            <p className="text-xs text-muted-foreground">
              No cierres esta ventana (suele tardar 2–5 minutos).
            </p>
          </div>
        ) : (
          <div className="space-y-4 py-4 text-center">
            <p className="text-sm font-medium text-foreground">
              Importados {resultSummary?.imported ?? 0} prospectos
            </p>
            {(resultSummary?.skippedDuplicate ?? 0) > 0 ? (
              <p className="text-sm text-muted-foreground">
                Omitidos {resultSummary?.skippedDuplicate} duplicados
              </p>
            ) : null}
            {(resultSummary?.skippedInvalid ?? 0) > 0 ? (
              <p className="text-sm text-muted-foreground">
                Omitidos {resultSummary?.skippedInvalid} filas inválidas
              </p>
            ) : null}
            <DialogFooter className="justify-center sm:justify-center">
              <Button type="button" onClick={() => handleOpenChange(false)}>
                Listo
              </Button>
            </DialogFooter>
          </div>
        )}

        {!apifyConfigured ? (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
