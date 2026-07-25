"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PILOT_PMS_ORGANIZATION_ID } from "@/lib/platform/constants.client";
import { cn } from "@/lib/utils";

type OwnerPmsEntryButtonProps = {
  className?: string;
  activeClassName?: string;
  idleClassName?: string;
  label?: string;
};

/**
 * Platform Owner → PMS: starts impersonation of the pilot tenant, then /panel.
 * Bare /panel without cookie redirects back to Resumen (by design).
 */
export function OwnerPmsEntryButton({
  className,
  activeClassName,
  idleClassName,
  label = "PMS",
}: OwnerPmsEntryButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  function enterPms() {
    if (busy || pending) return;
    setBusy(true);
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/owner/tenant/${PILOT_PMS_ORGANIZATION_ID}/impersonate`,
          { method: "POST" },
        );
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          redirectUrl?: string;
          error?: string;
        };
        if (!res.ok || !data.ok) {
          throw new Error(data.error || "No se pudo entrar al PMS");
        }
        router.push(data.redirectUrl || "/panel");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al entrar al PMS");
        setBusy(false);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={enterPms}
      disabled={busy || pending}
      className={cn(
        "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60",
        idleClassName,
        className,
        (busy || pending) && activeClassName,
      )}
      title="Abrir PMS del tenant piloto (impersonación)"
    >
      {busy || pending ? "Entrando…" : label}
    </button>
  );
}
