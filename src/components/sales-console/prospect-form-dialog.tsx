"use client";

import { Copy, ExternalLink, AtSign, MessageCircle, Phone, Sparkles } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import {
  createProspectAction,
  updateProspectAction,
} from "@/features/sales-console/actions/prospect.actions";
import { enrichProspectAction } from "@/features/sales-console/actions/prospect-enrich.actions";
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
import type { ProspectEnrichmentContent } from "@/modules/sales-console/enrichment/enrichment.types";
import { copyTextToClipboard } from "@/lib/copy-to-clipboard";
import { resolveStageOutreachTemplate } from "@/lib/prospecting/stage-outreach-templates";
import { buildWhatsAppLinkWithMessage } from "@/lib/prospecting/whatsapp-link";
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
  openAiConfigured: boolean;
  onSuccess: () => void;
};

const ENRICHMENT_FAILURE_TOAST = "No fue posible enriquecer el prospecto.";

const COPY_LABELS: Array<{ key: keyof ProspectEnrichmentContent; label: string }> = [
  { key: "brief", label: "Brief" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "email", label: "Email" },
  { key: "pitch", label: "Pitch" },
  { key: "objections", label: "Objeciones" },
  { key: "cta", label: "CTA" },
];

function showEnrichmentError(message: string) {
  toast.error(message === ENRICHMENT_FAILURE_TOAST ? ENRICHMENT_FAILURE_TOAST : message);
}

export function ProspectFormDialog({
  open,
  onOpenChange,
  mode,
  prospect,
  openAiConfigured,
  onSuccess,
}: ProspectFormDialogProps) {
  const [pending, startTransition] = useTransition();
  const [enriching, setEnriching] = useState(false);
  const [enrichmentContent, setEnrichmentContent] = useState<ProspectEnrichmentContent | null>(
    null,
  );
  const [outreachMessage, setOutreachMessage] = useState("");
  const [values, setValues] = useState<ProspectFormValues>(() =>
    mode === "edit" && prospect
      ? prospectToFormValues(prospect)
      : emptyProspectFormValues(),
  );

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && prospect) {
      setValues(prospectToFormValues(prospect));
      setOutreachMessage(
        resolveStageOutreachTemplate(prospect.status, prospect.companyName),
      );
      setEnrichmentContent(null);
      return;
    }
    setValues(emptyProspectFormValues());
    setOutreachMessage("");
    setEnrichmentContent(null);
  }, [open, mode, prospect]);

  useEffect(() => {
    if (mode !== "edit" || !open) return;
    setOutreachMessage((current) =>
      current.trim()
        ? current
        : resolveStageOutreachTemplate(values.status, values.companyName),
    );
  }, [values.status, values.companyName, mode, open]);

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

  async function handleEnrich() {
    if (!prospect) return;

    setEnriching(true);
    try {
      const result = await enrichProspectAction(prospect.id);
      if (!result.success) {
        showEnrichmentError(result.error);
        return;
      }

      setValues((current) => ({ ...current, notes: result.notes }));
      setEnrichmentContent(result.content);
      if (result.content.whatsapp?.trim()) {
        setOutreachMessage(result.content.whatsapp.trim());
      }
      toast.success("Material comercial generado");
      onSuccess();
    } finally {
      setEnriching(false);
    }
  }

  function resolveContactMessage() {
    return (
      enrichmentContent?.whatsapp?.trim() ||
      outreachMessage.trim() ||
      resolveStageOutreachTemplate(values.status, values.companyName)
    );
  }

  function handleWhatsAppContact() {
    const message = resolveContactMessage();
    const link = buildWhatsAppLinkWithMessage(values.phone, message);
    if (!link) {
      toast.error("Agrega un teléfono válido para contactar por WhatsApp.");
      return;
    }

    window.open(link, "_blank", "noopener,noreferrer");

    if (mode === "edit" && prospect && values.status === "NEW") {
      startTransition(async () => {
        const result = await updateProspectAction({
          id: prospect.id,
          companyName: values.companyName,
          phone: values.phone || null,
          website: values.website || null,
          instagram: values.instagram || null,
          city: values.city || null,
          segment: values.segment,
          source: values.source,
          notes: values.notes || null,
          status: "CONTACTED",
        });
        if (result.success) {
          setValues((current) => ({ ...current, status: "CONTACTED" }));
          onSuccess();
        }
      });
    }
  }

  function normalizeExternalUrl(raw: string | null | undefined): string | null {
    const value = raw?.trim();
    if (!value) return null;
    if (/^https?:\/\//i.test(value)) return value;
    return `https://${value}`;
  }

  const websiteUrl = normalizeExternalUrl(values.website);
  const instagramUrl = values.instagram?.trim()
    ? values.instagram.trim().startsWith("http")
      ? values.instagram.trim()
      : `https://instagram.com/${values.instagram.replace(/^@/, "")}`
    : null;

  const busy = pending || enriching;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Nuevo prospecto" : "Editar prospecto"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Entrada manual · el estado queda en Nuevo hasta que lo cambies en el pipeline."
              : "Actualiza los datos, enriquece con IA y copia mensajes listos para vender."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "edit" ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/20 p-2">
              <Button
                type="button"
                size="sm"
                className="gap-1.5"
                disabled={busy}
                onClick={handleWhatsAppContact}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                WhatsApp
              </Button>
              {websiteUrl ? (
                <Button type="button" size="sm" variant="outline" className="gap-1.5" asChild>
                  <a href={websiteUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Web
                  </a>
                </Button>
              ) : null}
              {instagramUrl ? (
                <Button type="button" size="sm" variant="outline" className="gap-1.5" asChild>
                  <a href={instagramUrl} target="_blank" rel="noreferrer">
                    <AtSign className="h-3.5 w-3.5" />
                    Instagram
                  </a>
                </Button>
              ) : null}
              {values.phone ? (
                <Button type="button" size="sm" variant="outline" className="gap-1.5" asChild>
                  <a href={`tel:${values.phone}`}>
                    <Phone className="h-3.5 w-3.5" />
                    Llamar
                  </a>
                </Button>
              ) : null}
            </div>
          ) : null}

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

          {mode === "edit" ? (
            <div className="space-y-1.5">
              <Label htmlFor="prospect-outreach">Mensaje para contacto</Label>
              <textarea
                id="prospect-outreach"
                value={outreachMessage}
                onChange={(event) => setOutreachMessage(event.target.value)}
                rows={4}
                className="w-full rounded-xl border border-input bg-white px-3 py-2 text-sm leading-relaxed dark:bg-card"
                placeholder="Plantilla editable según etapa del pipeline."
              />
              <p className="text-xs text-muted-foreground">
                Se usa al contactar por WhatsApp. Puedes ajustarla por etapa comercial.
              </p>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="prospect-notes">Notas</Label>
            <textarea
              id="prospect-notes"
              value={values.notes}
              onChange={(event) => updateField("notes", event.target.value)}
              rows={5}
              className="w-full rounded-xl border border-input bg-white px-3 py-2 font-mono text-xs leading-relaxed dark:bg-card"
              placeholder={
                mode === "edit"
                  ? "Usa Enriquecer para generar brief, mensajes y guion de venta."
                  : undefined
              }
            />
          </div>

          {mode === "edit" ? (
            <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">Asistente comercial</p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="gap-1.5"
                  disabled={!openAiConfigured || busy}
                  onClick={() => void handleEnrich()}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {enriching ? "Enriqueciendo…" : "Enriquecer"}
                </Button>
              </div>

              {!openAiConfigured ? (
                <p className="text-xs text-muted-foreground">
                  Configura OPENAI_API_KEY para habilitar el asistente comercial.
                </p>
              ) : enrichmentContent ? (
                <div className="flex flex-wrap gap-2">
                  {COPY_LABELS.map(({ key, label }) => (
                    <Button
                      key={key}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => void copyTextToClipboard(label, enrichmentContent[key])}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {label}
                    </Button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Genera brief, WhatsApp, email, pitch, objeciones y CTA con un clic.
                </p>
              )}
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy}>
              {pending ? "Guardando…" : mode === "create" ? "Crear" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
