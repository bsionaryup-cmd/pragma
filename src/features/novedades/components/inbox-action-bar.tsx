"use client";

import { Copy, ExternalLink, MessageCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type InboxActionBarProps = {
  onGenerateAi?: () => void;
  onCopy?: () => void | Promise<void>;
  generating?: boolean;
  airbnbHref?: string | null;
  whatsappHref?: string | null;
  className?: string;
};

async function copyFallback(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    toast.error("No hay texto para copiar");
    return;
  }
  try {
    await navigator.clipboard.writeText(trimmed);
    toast.success("Respuesta copiada");
  } catch {
    toast.error("No se pudo copiar");
  }
}

export function InboxActionBar({
  onGenerateAi,
  onCopy,
  generating = false,
  airbnbHref = "https://www.airbnb.com/hosting/inbox",
  whatsappHref = null,
  className,
}: InboxActionBarProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 flex-wrap items-center gap-2 border-t border-border/70 bg-module-pane/95 px-4 py-3",
        className,
      )}
    >
      {onGenerateAi ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-9 gap-1.5 border-primary/20 bg-primary/[0.04] text-primary hover:bg-primary/10"
          onClick={onGenerateAi}
          disabled={generating}
        >
          <Sparkles className="h-4 w-4" />
          Generar con IA
        </Button>
      ) : null}

      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-9 gap-1.5"
        onClick={() => {
          if (onCopy) {
            void onCopy();
            return;
          }
          void copyFallback("");
        }}
      >
        <Copy className="h-4 w-4" />
        Copiar
      </Button>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {airbnbHref ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-9 gap-1.5 text-muted-foreground hover:text-foreground"
            asChild
          >
            <a href={airbnbHref} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              Airbnb
            </a>
          </Button>
        ) : null}

        {whatsappHref ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-9 gap-1.5 text-muted-foreground hover:text-foreground"
            asChild
          >
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
