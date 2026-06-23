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
import { buildWhatsAppLinkWithMessage } from "@/lib/prospecting/whatsapp-link";
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

  function handleCopyPhone() {
    if (!current?.phone) {
      toast.error("Este prospecto no tiene teléfono");
      return;
    }
    void navigator.clipboard.writeText(current.phone);
    toast.success("Teléfono copiado");
    run(async () => {
      await patchLead({ activity: { type: "PHONE_COPIED" } });
    });
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

  function handleOpenWhatsApp() {
    if (!current) return;
    const link = buildWhatsAppLinkWithMessage(
      current.phone,
      current.outreachMessage ?? "",
    );
    if (!link) {
      toast.error("Teléfono inválido para WhatsApp");
      return;
    }
    window.open(link, "_blank", "noopener,noreferrer");
    run(async () => {
      await patchLead({
        activity: { type: "CONTACT_WHATSAPP" },
        status: current!.status === "NEW" ? "CONTACTED" : current!.status,
      });
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
      toast.success("Estado actualizado");
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
        message?: string;
        lead?: ProspectingLeadRow;
        error?: string;
      };
      if (!response.ok || !payload.success || !payload.lead) {
        throw new Error(payload.error ?? "No se pudo generar el mensaje");
      }
      setCurrent(payload.lead);
      onUpdated(payload.lead);
      toast.success("Mensaje generado");
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
        reasoning?: string;
        error?: string;
      };
      if (!response.ok || !payload.success || !payload.lead) {
        throw new Error(payload.error ?? "No se pudo clasificar el prospecto");
      }
      setCurrent(payload.lead);
      onUpdated(payload.lead);
      toast.success("Clasificación actualizada");
    });
  }

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <SheetHeader className="border-b border-border px-5 py-4 text-left">
          <SheetTitle className="pr-8 text-base">{current.businessName}</SheetTitle>
          <SheetDescription>
            {SOURCE_LABELS[current.source] ?? current.source}
            {current.category ? ` · ${current.category}` : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <section className="space-y-2">
            <Label>Estado</Label>
            <Select
              value={current.status}
              disabled={pending}
              onValueChange={handleStatusChange}
            >
              <SelectTrigger>
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
          </section>

          <section className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="justify-start gap-2"
              disabled={pending || !current.website}
              onClick={handleOpenWebsite}
            >
              <ExternalLink className="h-4 w-4" />
              Sitio web
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="justify-start gap-2"
              disabled={pending || !current.phone}
              onClick={handleCopyPhone}
            >
              <Copy className="h-4 w-4" />
              Copiar teléfono
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="col-span-2 justify-start gap-2"
              disabled={pending || !current.phone}
              onClick={handleOpenWhatsApp}
            >
              <MessageCircle className="h-4 w-4" />
              Abrir WhatsApp
            </Button>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Mensaje de contacto</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 px-2"
                disabled={pending || !openAiConfigured}
                onClick={handleGenerateOutreach}
              >
                {pending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {current.outreachMessage ? "Regenerar" : "Generar"}
              </Button>
            </div>
            {!openAiConfigured ? (
              <p className="text-xs text-muted-foreground">
                Configura OPENAI_API_KEY para generar mensajes de descubrimiento.
              </p>
            ) : null}
            <Textarea
              rows={5}
              value={current.outreachMessage ?? ""}
              readOnly
              placeholder="Genera un mensaje natural para iniciar conversación (sin pitch de ventas)."
              className="resize-none text-sm"
            />
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Clasificación IA</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 px-2"
                disabled={pending || !openAiConfigured}
                onClick={handleGenerateInsights}
              >
                {pending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Clasificar
              </Button>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <p>
                <span className="text-muted-foreground">Tipo:</span>{" "}
                {current.leadType
                  ? PROSPECTING_LEAD_TYPE_LABELS[current.leadType]
                  : "—"}
              </p>
              <p className="mt-1">
                <span className="text-muted-foreground">Sofisticación:</span>{" "}
                {current.estimatedSophistication
                  ? PROSPECTING_FIT_LABELS[current.estimatedSophistication]
                  : "—"}
              </p>
              <p className="mt-1">
                <span className="text-muted-foreground">Fit PRAGMA:</span>{" "}
                {current.potentialPragmaFit
                  ? PROSPECTING_FIT_LABELS[current.potentialPragmaFit]
                  : "—"}
              </p>
            </div>
          </section>

          <section className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <StickyNote className="h-3.5 w-3.5" />
              Notas
            </Label>
            <Textarea
              rows={4}
              value={notesDraft}
              disabled={pending}
              onChange={(e) => setNotesDraft(e.target.value)}
              placeholder="Registra lo que aprendiste en la conversación…"
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={handleSaveNotes}
            >
              Guardar notas
            </Button>
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 text-sm">
              <p className="text-muted-foreground">Último contacto</p>
              <p>{formatDate(current.lastContactDate)}</p>
            </div>
            <div className="space-y-1 text-sm">
              <p className="text-muted-foreground">Seguimientos</p>
              <p>{current.followUpCount}</p>
            </div>
          </section>

          <section className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <CalendarClock className="h-3.5 w-3.5" />
              Próximo seguimiento
            </Label>
            <div className="flex gap-2">
              <Input
                type="date"
                value={followUpDraft}
                disabled={pending}
                onChange={(e) => setFollowUpDraft(e.target.value)}
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={handleSaveFollowUp}
              >
                Guardar
              </Button>
            </div>
          </section>

          {current.activityLog.length > 0 ? (
            <section className="space-y-2">
              <Label>Historial</Label>
              <ul className="space-y-2 text-xs text-muted-foreground">
                {[...current.activityLog].reverse().slice(0, 12).map((entry) => (
                  <li key={entry.id} className="rounded-md border border-border px-3 py-2">
                    <p className="text-foreground/90">{entry.summary}</p>
                    <p className="mt-1">{formatDate(entry.at)}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
