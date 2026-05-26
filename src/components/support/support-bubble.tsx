"use client";

import { useState, useTransition } from "react";
import { ImagePlus, LifeBuoy, X } from "lucide-react";
import { toast } from "sonner";
import {
  createSupportTicketAction,
  getTenantSupportTicketDetailAction,
  listTenantSupportTicketsAction,
  tenantCloseSupportTicketAction,
  tenantReplySupportTicketAction,
} from "@/features/support/actions/support.actions";
import {
  getBrowserDiagnostics,
  getClientDiagnostics,
} from "@/lib/client/client-diagnostics";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type SupportBubbleProps = {
  routeContext?: string;
  propertyId?: string;
  reservationId?: string;
};

const MAX_SCREENSHOT_BYTES = 280_000;

export function SupportBubble({
  routeContext,
  propertyId,
  reservationId,
}: SupportBubbleProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<"new" | "tickets">("new");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [category, setCategory] = useState<
    "BUG" | "RESERVATIONS" | "INTEGRATIONS" | "ACCESS" | "OTHER"
  >("OTHER");
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketDetail, setTicketDetail] = useState<any | null>(null);
  const [replyText, setReplyText] = useState("");

  function onScreenshot(file: File | null) {
    if (!file) {
      setScreenshotPreview(null);
      return;
    }
    if (file.size > MAX_SCREENSHOT_BYTES) {
      toast.error("La captura debe ser menor a 280 KB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : null;
      setScreenshotPreview(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  function submit() {
    startTransition(async () => {
      const result = await createSupportTicketAction({
        subject,
        body,
        category,
        propertyId,
        reservationId,
        routeContext: routeContext ?? window.location.pathname,
        clientErrors: getClientDiagnostics(),
        browser: getBrowserDiagnostics() ?? undefined,
        screenshotPreview: screenshotPreview ?? undefined,
      });
      if (!result.success) {
        toast.error("No se pudo crear el ticket");
        return;
      }
      toast.success("Ticket enviado · PRAGMA Support");
      setSubject("");
      setBody("");
      setScreenshotPreview(null);
      setTab("tickets");
      void loadTickets();
      setOpen(false);
    });
  }

  function loadTickets() {
    return (async () => {
      const result = await listTenantSupportTicketsAction();
      if (!result.success) return;
      setTickets(result.tickets as any);
      if (!selectedTicketId && (result.tickets as any[])[0]?.id) {
        setSelectedTicketId((result.tickets as any[])[0].id);
      }
    })();
  }

  async function loadTicketDetail(ticketId: string) {
    const result = await getTenantSupportTicketDetailAction({ ticketId });
    if (!result.success) {
      toast.error(result.error ?? "No se pudo cargar el ticket");
      return;
    }
    setTicketDetail(result.ticket);
  }

  function sendTenantReply() {
    if (!selectedTicketId || !replyText.trim()) return;
    startTransition(async () => {
      const result = await tenantReplySupportTicketAction({
        ticketId: selectedTicketId,
        body: replyText,
      });
      if (!result.success) {
        toast.error(result.error ?? "No se pudo enviar la respuesta");
        return;
      }
      setReplyText("");
      toast.success("Mensaje enviado");
      await loadTicketDetail(selectedTicketId);
      await loadTickets();
    });
  }

  function closeTicket() {
    if (!selectedTicketId) return;
    startTransition(async () => {
      const result = await tenantCloseSupportTicketAction({ ticketId: selectedTicketId });
      if (!result.success) {
        toast.error(result.error ?? "No se pudo cerrar el ticket");
        return;
      }
      toast.success("Ticket marcado como resuelto");
      await loadTicketDetail(selectedTicketId);
      await loadTickets();
    });
  }

  return (
    <>
      <button
        type="button"
        aria-label="Abrir PRAGMA Support"
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-5 right-5 z-[45] flex h-12 w-12 items-center justify-center rounded-full",
          "border border-pragma-electric/30 bg-card/95 text-pragma-electric shadow-pragma-card backdrop-blur-sm",
          "transition-transform hover:scale-105 hover:bg-pragma-electric/10",
          "max-md:bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))]",
        )}
      >
        <LifeBuoy className="h-5 w-5" aria-hidden />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="z-[50] flex w-full flex-col gap-0 border-border/80 bg-card p-0 sm:max-w-md"
        >
          <SheetHeader className="border-b border-border px-5 py-4 text-start">
            <div className="flex items-start justify-between gap-3">
              <div>
                <SheetTitle className="font-heading text-lg">PRAGMA Support</SheetTitle>
                <SheetDescription className="text-xs">
                  PRAGMA Operations · contexto técnico adjunto automáticamente
                </SheetDescription>
              </div>
              <button
                type="button"
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </SheetHeader>

          <div className="border-b border-border px-5 py-3">
            <div className="flex gap-2">
              <button
                type="button"
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium",
                  tab === "new"
                    ? "bg-pragma-electric/10 text-pragma-electric"
                    : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                )}
                onClick={() => setTab("new")}
              >
                Nuevo ticket
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium",
                  tab === "tickets"
                    ? "bg-pragma-electric/10 text-pragma-electric"
                    : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                )}
                onClick={() => {
                  setTab("tickets");
                  void loadTickets();
                }}
              >
                Mis tickets
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <p className="rounded-lg bg-pragma-light-blue/30 px-3 py-2 text-[11px] text-muted-foreground">
              Ruta:{" "}
              <span className="font-medium text-foreground">
                {routeContext ?? "—"}
              </span>
              <span className="mt-1 block">
                Incluye rol, dispositivo y últimos errores del navegador (sin datos personales).
              </span>
            </p>

            {tab === "tickets" ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">Tickets</p>
                  <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => void loadTickets()}>
                    Actualizar
                  </Button>
                </div>
                <div className="grid gap-2">
                  {tickets.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aún no tienes tickets.</p>
                  ) : (
                    tickets.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setSelectedTicketId(t.id);
                          void loadTicketDetail(t.id);
                        }}
                        className={cn(
                          "rounded-xl border border-border px-3 py-2 text-start text-sm hover:bg-muted/30",
                          selectedTicketId === t.id && "bg-pragma-light-blue/20",
                        )}
                      >
                        <div className="font-medium line-clamp-1">{t.subject}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {t.status} · {t.category} · {t.priority}
                        </div>
                      </button>
                    ))
                  )}
                </div>

                {ticketDetail ? (
                  <div className="rounded-xl border border-border bg-muted/10 p-3">
                    <p className="text-sm font-semibold">{ticketDetail.subject}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Estado: {ticketDetail.status}
                      {ticketDetail.assignedTo?.email ? ` · Asignado: ${ticketDetail.assignedTo.email}` : ""}
                    </p>
                    <div className="mt-3 max-h-44 space-y-2 overflow-y-auto rounded-lg border border-border/70 bg-background/50 p-2">
                      {ticketDetail.messages?.map((m: any, i: number) => (
                        <div key={m.id ?? i} className="text-sm">
                          <span className="text-[11px] font-medium text-pragma-electric">
                            {m.authorKind === "platform" ? "PRAGMA" : "Tú"}
                          </span>
                          <p className="mt-0.5">{m.body}</p>
                        </div>
                      ))}
                    </div>
                    <textarea
                      className="mt-3 min-h-[90px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Responder…"
                    />
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button type="button" variant="brand" size="sm" disabled={pending || !replyText.trim()} onClick={sendTenantReply}>
                        Enviar
                      </Button>
                      <Button type="button" variant="outline" size="sm" disabled={pending} onClick={closeTicket}>
                        Marcar resuelto
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {tab === "new" ? (
              <div className="space-y-4">
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium">Asunto</span>
                  <input
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Describe el problema brevemente"
                  />
                </label>

                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium">Categoría</span>
                  <select
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as typeof category)}
                  >
                    <option value="BUG">Error / bug</option>
                    <option value="RESERVATIONS">Reservas</option>
                    <option value="INTEGRATIONS">Integraciones</option>
                    <option value="ACCESS">Acceso / cerraduras</option>
                    <option value="OTHER">Otro</option>
                  </select>
                </label>

                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium">Detalle</span>
                  <textarea
                    className="min-h-[120px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Qué esperabas, qué ocurrió, pasos para reproducir…"
                  />
                </label>

                <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                  <ImagePlus className="h-4 w-4 shrink-0" />
                  <span>Adjuntar captura (opcional)</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={(e) => onScreenshot(e.target.files?.[0] ?? null)}
                  />
                </label>
                {screenshotPreview ? (
                  <p className="text-[11px] text-pragma-electric">Captura lista para enviar</p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="border-t border-border px-5 py-4">
            <p className="mb-2 text-center text-[10px] text-muted-foreground">
              Technical Team · Platform Admin
            </p>
            <Button
              type="button"
              variant="brand"
              className="w-full"
              disabled={tab !== "new" || pending || subject.trim().length < 3 || body.trim().length < 10}
              onClick={submit}
            >
              {pending ? "Enviando…" : "Enviar ticket"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
