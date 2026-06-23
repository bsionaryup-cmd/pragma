"use client";

import { useEffect, useState, useTransition } from "react";
import {
  CalendarClock,
  Copy,
  ExternalLink,
  Loader2,
  MessageCircle,
  Sparkles,
  StickyNote,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { runQuickContactFlow } from "@/features/prospecting/lib/quick-contact";
import {
  PRIORITY_BADGE_CLASS,
  PRIORITY_LABELS,
} from "@/lib/prospecting/prospecting-score";
import type { ProspectingLeadRow } from "@/services/prospecting/prospecting-lead.service";
import {
  PROSPECTING_FIT_LABELS,
  PROSPECTING_LEAD_STATUSES,
  PROSPECTING_LEAD_TYPE_LABELS,
  PROSPECTING_STATUS_LABELS,
} from "@/services/prospecting/prospecting-crm.types";

const SOURCE_LABELS: Record<string, string> = {
  GOOGLE_MAPS: "Google Maps",
  AIRBNB: "Airbnb",
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  BOOKING: "Booking",
  LINKEDIN: "LinkedIn",
};

type ProspectingLeadDrawerProps = {
  lead: ProspectingLeadRow | null;
  open: boolean;
  openAiConfigured: boolean;
  onClose: () => void;
  onUpdated: (lead: ProspectingLeadRow) => void;
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ProspectingLeadDrawer({
  lead,
  open,
  openAiConfigured,
  onClose,
  onUpdated,
}: ProspectingLeadDrawerProps) {
  const [current, setCurrent] = useState<ProspectingLeadRow | null>(lead);
  const [notesDraft, setNotesDraft] = useState("");
  const [followUpDraft, setFollowUpDraft] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setCurrent(lead);
    setNotesDraft(lead?.notes ?? "");
    setFollowUpDraft(
      lead?.nextFollowUpDate ? lead.nextFollowUpDate.slice(0, 10) : "",
    );
  }, [lead]);

  if (!current) return null;

  async function patchLead(body: Record<string, unknown>) {
    const response = await fetch(`/api/prospecting/leads/${current!.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as {
      success?: boolean;
      lead?: ProspectingLeadRow;
      error?: string;
    };
    if (!response.ok || !payload.success || !payload.lead) {
      throw new Error(payload.error ?? "No se pudo guardar");
    }
    setCurrent(payload.lead);
    onUpdated(payload.lead);
    return payload.lead;
  }

  function run(action: () => Promise<void>) {
    startTransition(async () => {
      try {
        await action();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Error inesperado");
      }
    });
  }

  function handleQuickContact() {
    if (!current) return;
    run(async () => {
      const updated = await runQuickContactFlow(current, openAiConfigured);
      setCurrent(updated);
      onUpdated(updated);
      toast.success("Mensaje copiado · WhatsApp abierto");
    });
  }

  function handleCopyMessage() {
    if (!current?.outreachMessage?.trim()) {
      toast.error("Genera un mensaje primero");
      return;
    }
    void navigator.clipboard.writeText(current.outreachMessage);
    toast.success("Mensaje copiado");
  }

  function handleOpenWebsite() {
    if (!current?.website) {
      toast.error("Este prospecto no tiene sitio web");
      return;
    }
    const href = current.website.startsWith("http")
      ? current.website
      : `https://${current.website}`;
    window.open(href, "_blank", "noopener,noreferrer");
    run(async () => {
      await patchLead({ activity: { type: "CONTACT_WEBSITE" } });
    });
  }

  function handleSaveNotes() {
    run(async () => {
      await patchLead({ notes: notesDraft.trim() || null });
      toast.success("Notas guardadas");
    });
  }

  function handleSaveFollowUp() {
    if (!current) return;
    run(async () => {
      await patchLead({
        nextFollowUpDate: followUpDraft
          ? new Date(`${followUpDraft}T12:00:00.000Z`).toISOString()
          : null,
        status: followUpDraft ? "FOLLOW_UP" : current.status,
      });
      toast.success("Seguimiento actualizado");
    });
  }

  function handleStatusChange(status: string) {
    run(async () => {
      await patchLead({ status });
    });
  }

  function handleGenerateOutreach() {
    if (!current) return;
    run(async () => {
      const response = await fetch(`/api/prospecting/leads/${current.id}/outreach`, {
        method: "POST",
      });
      const payload = (await response.json()) as {
        success?: boolean;
        lead?: ProspectingLeadRow;
        error?: string;
      };
      if (!response.ok || !payload.success || !payload.lead) {
        throw new Error(payload.error ?? "No se pudo generar el mensaje");
      }
      setCurrent(payload.lead);
      onUpdated(payload.lead);
      toast.success("Mensaje listo");
    });
  }

  function handleGenerateInsights() {
    if (!current) return;
    run(async () => {
      const response = await fetch(`/api/prospecting/leads/${current.id}/insights`, {
        method: "POST",
      });
      const payload = (await response.json()) as {
        success?: boolean;
        lead?: ProspectingLeadRow;
        error?: string;
      };
      if (!response.ok || !payload.success || !payload.lead) {
        throw new Error(payload.error ?? "No se pudo clasificar el prospecto");
      }
      setCurrent(payload.lead);
      onUpdated(payload.lead);
      toast.success("Score actualizado");
    });
  }

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <SheetHeader className="border-b border-border px-5 py-4 text-left">
          <div className="flex flex-wrap items-center gap-2 pr-8">
            <Badge variant="outline" className={PRIORITY_BADGE_CLASS[current.priority]}>
              {current.priority}
            </Badge>
            <span className="text-xs font-semibold tabular-nums">
              Score {current.prospectingScore}
            </span>
            <span className="text-xs text-muted-foreground">
              {PRIORITY_LABELS[current.priority]}
            </span>
          </div>
          <SheetTitle className="mt-2 text-base">{current.businessName}</SheetTitle>
          <SheetDescription>
            {current.phone ?? "Sin teléfono"}
            {current.website ? ` · ${current.website}` : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="border-b border-border px-5 py-3">
          <Button
            type="button"
            className="w-full gap-2"
            disabled={pending || !current.phone}
            onClick={handleQuickContact}
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MessageCircle className="h-4 w-4" />
            )}
            Contactar por WhatsApp
          </Button>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Genera (si falta), copia y abre WhatsApp en un solo paso
          </p>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">Mensaje</Label>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={pending || !current.outreachMessage}
                  onClick={handleCopyMessage}
                >
                  <Copy className="mr-1 h-3 w-3" />
                  Copiar
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={pending || !openAiConfigured}
                  onClick={handleGenerateOutreach}
                >
                  <Sparkles className="mr-1 h-3 w-3" />
                  {current.outreachMessage ? "Nuevo" : "Generar"}
                </Button>
              </div>
            </div>
            <Textarea
              rows={4}
              value={current.outreachMessage ?? ""}
              readOnly
              placeholder={
                openAiConfigured
                  ? "Pulsa Contactar o Generar para crear el mensaje."
                  : "Configura OPENAI_API_KEY para mensajes automáticos."
              }
              className="resize-none text-sm"
            />
          </section>

          <section className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Estado</Label>
              <Select
                value={current.status}
                disabled={pending}
                onValueChange={handleStatusChange}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROSPECTING_LEAD_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {PROSPECTING_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Seguimiento</Label>
              <Input
                type="date"
                className="h-9"
                value={followUpDraft}
                disabled={pending}
                onChange={(e) => setFollowUpDraft(e.target.value)}
                onBlur={handleSaveFollowUp}
              />
            </div>
          </section>

          <section className="rounded-lg border border-border bg-muted/20 p-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-foreground">Inteligencia</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                disabled={pending || !openAiConfigured}
                onClick={handleGenerateInsights}
              >
                <Sparkles className="mr-1 h-3 w-3" />
                Actualizar
              </Button>
            </div>
            <p className="mt-2">
              Tipo:{" "}
              {current.leadType ? PROSPECTING_LEAD_TYPE_LABELS[current.leadType] : "—"}
            </p>
            <p>
              Fit:{" "}
              {current.potentialPragmaFit
                ? PROSPECTING_FIT_LABELS[current.potentialPragmaFit]
                : "—"}
              {current.airbnbScore
                ? ` · Airbnb ${PROSPECTING_FIT_LABELS[current.airbnbScore]}`
                : ""}
            </p>
            <p className="text-muted-foreground">
              {SOURCE_LABELS[current.source] ?? current.source}
              {current.category ? ` · ${current.category}` : ""}
            </p>
            {current.website ? (
              <Button
                type="button"
                variant="link"
                className="mt-1 h-auto p-0 text-xs"
                onClick={handleOpenWebsite}
              >
                <ExternalLink className="mr-1 h-3 w-3" />
                Abrir sitio web
              </Button>
            ) : null}
          </section>

          <section className="space-y-2">
            <Label className="flex items-center gap-1.5 text-xs">
              <StickyNote className="h-3.5 w-3.5" />
              Notas
            </Label>
            <Textarea
              rows={3}
              value={notesDraft}
              disabled={pending}
              onChange={(e) => setNotesDraft(e.target.value)}
              onBlur={handleSaveNotes}
              placeholder="¿Qué respondió? ¿Cuál es su dolor operativo?"
            />
          </section>

          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <p>Último contacto: {formatDate(current.lastContactDate)}</p>
            <p>Seguimientos: {current.followUpCount}</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
