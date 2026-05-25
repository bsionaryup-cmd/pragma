"use client";

import { useState, useTransition } from "react";
import { ImagePlus, LifeBuoy, X } from "lucide-react";
import { toast } from "sonner";
import { createSupportTicketAction } from "@/features/support/actions/support.actions";
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
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [category, setCategory] = useState<
    "BUG" | "RESERVATIONS" | "INTEGRATIONS" | "ACCESS" | "OTHER"
  >("OTHER");

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
      setOpen(false);
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

          <div className="border-t border-border px-5 py-4">
            <p className="mb-2 text-center text-[10px] text-muted-foreground">
              Technical Team · Platform Admin
            </p>
            <Button
              type="button"
              variant="brand"
              className="w-full"
              disabled={pending || subject.trim().length < 3 || body.trim().length < 10}
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
