"use client";

import { Wifi } from "lucide-react";
import { StayPortalCopyButton } from "./stay-portal-copy-button";

type WifiCardProps = {
  wifiName: string | null;
  wifiPassword: string | null;
};

export function WifiCard({ wifiName, wifiPassword }: WifiCardProps) {
  if (!wifiName && !wifiPassword) return null;

  const copyValue = wifiPassword || wifiName || "";

  return (
    <section
      id="stay-wifi"
      aria-labelledby="stay-wifi-title"
      className="scroll-mt-4 rounded-2xl border border-border bg-card p-4 shadow-pragma-soft sm:p-5"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"
              aria-hidden
            >
              <Wifi className="h-5 w-5" />
            </span>
            <h2
              id="stay-wifi-title"
              className="text-base font-semibold text-foreground"
            >
              WiFi
            </h2>
          </div>

          <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-6">
            {wifiName ? (
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">Red</p>
                <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
                  {wifiName}
                </p>
              </div>
            ) : null}
            {wifiPassword ? (
              <div className="min-w-0 sm:border-l sm:border-border sm:pl-6">
                <p className="text-xs font-medium text-muted-foreground">
                  Contraseña
                </p>
                <p className="mt-0.5 break-all font-mono text-sm font-semibold text-foreground">
                  {wifiPassword}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        {copyValue ? (
          <StayPortalCopyButton
            value={copyValue}
            label={wifiPassword ? "Contraseña WiFi" : "Red WiFi"}
            variant="outline-blue"
            className="w-full sm:w-auto"
          >
            Copiar
          </StayPortalCopyButton>
        ) : null}
      </div>
    </section>
  );
}
