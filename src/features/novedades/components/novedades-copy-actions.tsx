"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";
import type { NovedadesSuggestedAction } from "@/services/novedades/novedades-inbox.types";
import { cn } from "@/lib/utils";

type NovedadesCopyActionsProps = {
  actions: NovedadesSuggestedAction[];
  compact?: boolean;
  className?: string;
};

async function copyMessage(text: string, label: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    toast.error("No hay texto para copiar");
    return;
  }
  try {
    await navigator.clipboard.writeText(trimmed);
    toast.success(`${label} copiado — pégalo en Airbnb`);
  } catch {
    toast.error("No se pudo copiar el mensaje");
  }
}

export function NovedadesCopyActions({
  actions,
  compact = false,
  className,
}: NovedadesCopyActionsProps) {
  if (actions.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          title={action.hint}
          onClick={() => void copyMessage(action.messageText, action.label)}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
            action.variant === "primary"
              ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
              : "border-border bg-background text-foreground hover:bg-muted/50",
            compact && "px-2 py-0.5 text-[10px]",
          )}
        >
          <Copy className={cn("shrink-0 opacity-70", compact ? "h-3 w-3" : "h-3.5 w-3.5")} />
          {action.label}
        </button>
      ))}
    </div>
  );
}
