"use client";

import { useRouter } from "next/navigation";
import { ShieldAlert, X } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

type ImpersonationBannerProps = {
  organizationName: string;
};

export function ImpersonationBanner({
  organizationName,
}: ImpersonationBannerProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function exitImpersonation() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/owner/impersonate/end", { method: "POST" });
        const data = (await res.json()) as { redirectUrl?: string; error?: string };
        if (!res.ok) {
          setError(data.error ?? "No se pudo salir del modo Super Admin");
          return;
        }
        router.push(data.redirectUrl ?? "/owner-dashboard");
        router.refresh();
      } catch {
        setError("Error de red al salir del modo Super Admin");
      }
    });
  }

  return (
    <div
      role="status"
      className="border-b border-amber-300/60 bg-amber-50 px-4 py-2.5 text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100"
    >
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden />
          <p className="font-medium">
            You are viewing this tenant as Super Admin
            {organizationName ? (
              <span className="font-normal text-amber-900/80 dark:text-amber-100/80">
                {" "}
                — {organizationName}
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {error ? (
            <span className="text-xs text-red-600 dark:text-red-300">{error}</span>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={exitImpersonation}
            className="border-amber-400/70 bg-white/80 hover:bg-white dark:border-amber-500/40 dark:bg-amber-950/60"
          >
            <X className="h-3.5 w-3.5" />
            Salir de impersonación
          </Button>
        </div>
      </div>
    </div>
  );
}
