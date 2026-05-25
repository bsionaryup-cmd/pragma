"use client";

import { Copy, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatAccessCode } from "@/lib/access-code";
import { cn } from "@/lib/utils";

type AccessCodeDisplayProps = {
  code: string | null | undefined;
  status?: string;
  isActive?: boolean;
  className?: string;
  defaultVisible?: boolean;
  variant?: "card" | "inline";
};

export function AccessCodeDisplay({
  code,
  status,
  isActive,
  className,
  defaultVisible = false,
  variant = "card",
}: AccessCodeDisplayProps) {
  const [visible, setVisible] = useState(defaultVisible);
  const displayCode = formatAccessCode(code);
  const hasCode = Boolean(displayCode);
  const statusLabel =
    isActive !== undefined
      ? isActive
        ? "Activo"
        : (status ?? "Suspendido")
      : (status ?? "—");

  async function copyCode() {
    if (!displayCode) return;
    try {
      await navigator.clipboard.writeText(displayCode);
      toast.success("Código copiado");
    } catch {
      toast.error("No se pudo copiar el código");
    }
  }

  if (variant === "inline") {
    if (!hasCode) return null;

    return (
      <div
        className={cn(
          "inline-flex w-fit max-w-full items-center gap-2 rounded-md border border-border/70 bg-muted/25 px-2.5 py-1.5",
          className,
        )}
      >
        <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Código
        </span>
        <span className="shrink-0 font-mono text-sm tracking-wider text-foreground">
          {visible ? displayCode : "••••••#"}
        </span>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Ocultar código" : "Mostrar código"}
          >
            {visible ? (
              <EyeOff className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={copyCode}
            aria-label="Copiar código"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-1.5 py-px text-[10px] font-medium",
            isActive
              ? "bg-success/10 text-success"
              : "bg-warning/10 text-warning",
          )}
        >
          {statusLabel}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-primary/15 bg-primary/5 px-3 py-2.5",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Código de acceso
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {statusLabel}
          </p>
          {hasCode ? (
            <p className="mt-1 font-mono text-base font-bold tracking-widest text-foreground">
              {visible ? displayCode : "••••••#"}
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              Aún no generado
            </p>
          )}
        </div>
        {hasCode ? (
          <div className="flex shrink-0 gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? "Ocultar código" : "Mostrar código"}
            >
              {visible ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={copyCode}
              aria-label="Copiar código"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
