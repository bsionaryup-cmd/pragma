"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type StayPortalCopyButtonProps = {
  value: string;
  label: string;
  children?: React.ReactNode;
  className?: string;
  variant?: "solid-green" | "outline-blue" | "outline";
};

export function StayPortalCopyButton({
  value,
  label,
  children,
  className,
  variant = "outline",
}: StayPortalCopyButtonProps) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        variant === "solid-green" &&
          "bg-emerald-600 text-white hover:bg-emerald-700",
        variant === "outline-blue" &&
          "border-2 border-primary bg-card text-primary hover:bg-primary/5",
        variant === "outline" &&
          "border border-border bg-card text-foreground hover:bg-muted/50",
        className,
      )}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success(`${label} copiado`);
          window.setTimeout(() => setCopied(false), 2000);
        } catch {
          toast.error("No se pudo copiar");
        }
      }}
    >
      {copied ? (
        <Check className="h-4 w-4" aria-hidden />
      ) : (
        <Copy className="h-4 w-4" aria-hidden />
      )}
      {children ?? (copied ? "Copiado" : "Copiar")}
    </button>
  );
}
