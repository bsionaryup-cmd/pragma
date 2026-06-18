"use client";

import { Copy, Loader2, Sparkles } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  generateInboxAiDraftAction,
  recordInboxAiDraftCopiedAction,
  updateInboxAiDraftAction,
} from "@/features/novedades/actions/inbox-ai.actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type NovedadesAiDraftPanelProps = {
  reservationId: string;
  guestMessageId: string;
  guestMessageBody: string;
  className?: string;
};

export function NovedadesAiDraftPanel({
  reservationId,
  guestMessageId,
  guestMessageBody,
  className,
}: NovedadesAiDraftPanelProps) {
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [intentLabel, setIntentLabel] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (!guestMessageBody.trim()) {
      toast.error("No hay mensaje del huésped para responder");
      return;
    }

    setGenerating(true);
    try {
      const result = await generateInboxAiDraftAction({
        reservationId,
        guestMessageId,
        guestMessageBody,
      });

      if (!result.success || !result.draft) {
        toast.error(result.error ?? "No se pudo generar el borrador");
        return;
      }

      setDraftId(result.draft.id);
      setDraftText(result.draft.displayText);
      setIntentLabel(result.draft.intentLabel);
      setProvider(result.draft.generationProvider);
      setExpanded(true);
      toast.success(
        result.draft.generationProvider === "openai"
          ? "Borrador generado con IA"
          : "Borrador generado (plantilla)",
      );
    } catch {
      toast.error("Error al generar con IA");
    } finally {
      setGenerating(false);
    }
  }, [guestMessageBody, guestMessageId, reservationId]);

  const handleSave = useCallback(async () => {
    if (!draftId || !draftText.trim()) return;

    setSaving(true);
    try {
      const result = await updateInboxAiDraftAction({
        draftId,
        editedText: draftText,
      });
      if (!result.success) {
        toast.error(result.error ?? "No se pudo guardar");
        return;
      }
      toast.success("Borrador guardado");
    } catch {
      toast.error("No se pudo guardar el borrador");
    } finally {
      setSaving(false);
    }
  }, [draftId, draftText]);

  const handleCopy = useCallback(async () => {
    const trimmed = draftText.trim();
    if (!trimmed) {
      toast.error("No hay texto para copiar");
      return;
    }

    try {
      await navigator.clipboard.writeText(trimmed);
      if (draftId) {
        void recordInboxAiDraftCopiedAction(draftId);
      }
      toast.success("Borrador copiado — pégalo en Airbnb");
    } catch {
      toast.error("No se pudo copiar");
    }
  }, [draftId, draftText]);

  return (
    <div className={cn("mt-3 max-w-[min(100%,36rem)]", className)}>
      {!expanded ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 border-primary/25 bg-primary/[0.04] text-xs font-medium text-primary hover:bg-primary/10"
          onClick={() => void handleGenerate()}
          disabled={generating}
        >
          {generating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          Generar con IA
        </Button>
      ) : (
        <div className="rounded-xl border border-primary/20 bg-module-pane/80 p-3 shadow-sm">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                Borrador IA
              </span>
              {intentLabel ? (
                <span className="rounded bg-sky-500/12 px-1.5 py-0.5 text-[10px] font-semibold text-sky-800 dark:text-sky-200">
                  {intentLabel}
                </span>
              ) : null}
              {provider ? (
                <span className="text-[10px] text-muted-foreground">
                  {provider === "openai" ? "OpenAI" : "Plantilla"}
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-[11px]"
                onClick={() => void handleCopy()}
              >
                <Copy className="h-3 w-3" />
                Copiar
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px]"
                onClick={() => void handleGenerate()}
                disabled={generating}
              >
                {generating ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  "Regenerar"
                )}
              </Button>
            </div>
          </div>

          <Textarea
            value={draftText}
            onChange={(event) => setDraftText(event.target.value)}
            onBlur={() => void handleSave()}
            rows={5}
            className="min-h-[7rem] resize-y text-sm leading-relaxed"
            placeholder="El borrador aparecerá aquí…"
            disabled={generating}
          />

          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-[10px] text-muted-foreground">
              Edita antes de copiar. No se envía automáticamente.
            </p>
            {saving ? (
              <span className="text-[10px] text-muted-foreground">Guardando…</span>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
