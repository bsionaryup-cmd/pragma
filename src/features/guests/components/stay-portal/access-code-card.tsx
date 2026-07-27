"use client";

import { Clock, Lock } from "lucide-react";
import { formatAccessCode } from "@/lib/access-code";
import { StayPortalCopyButton } from "./stay-portal-copy-button";

type AccessCodeCardProps = {
  code: string | null;
  validTo: string | null;
};

export function AccessCodeCard({ code, validTo }: AccessCodeCardProps) {
  const displayCode = formatAccessCode(code);

  return (
    <section
      aria-labelledby="stay-access-code-title"
      className="rounded-2xl border border-emerald-200/80 bg-emerald-50/70 p-4 shadow-pragma-soft sm:p-5"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3 sm:items-center">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm"
            aria-hidden
          >
            <Lock className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p
              id="stay-access-code-title"
              className="text-sm font-medium text-muted-foreground"
            >
              Tu código de acceso
            </p>
            {displayCode ? (
              <p className="mt-1 break-all font-mono text-3xl font-bold tracking-wider text-emerald-700 sm:text-4xl">
                {displayCode}
              </p>
            ) : (
              <p className="mt-1 text-base font-semibold text-foreground">
                Pendiente de generación
              </p>
            )}
            {validTo ? (
              <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground sm:items-center sm:text-sm">
                <Clock
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 sm:mt-0"
                  aria-hidden
                />
                <span>Válido hasta {validTo}</span>
              </p>
            ) : null}
          </div>
        </div>
        {displayCode ? (
          <StayPortalCopyButton
            value={displayCode}
            label="Código"
            variant="solid-green"
            className="w-full sm:w-auto"
          >
            Copiar código
          </StayPortalCopyButton>
        ) : null}
      </div>
    </section>
  );
}
