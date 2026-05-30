"use client";

import { useState, useTransition } from "react";
import { ChevronDown, Eye, EyeOff, KeyRound } from "lucide-react";
import { toast } from "sonner";
import {
  revokePriceLabsApiKeyAction,
  savePriceLabsApiKeyAction,
} from "@/features/integrations/pricelabs/actions/pricelabs.actions";
import type { PriceLabsOverviewDto } from "@/services/integrations/pricelabs.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PriceLabsApiKeyCardProps = {
  overview: PriceLabsOverviewDto;
  canManage: boolean;
  embedded?: boolean;
};

const credentialStatusLabels: Record<
  PriceLabsOverviewDto["credentials"]["status"],
  string
> = {
  missing: "Sin API key",
  stored: "Guardada",
  environment: "Entorno",
  both: "BD + entorno",
};

export function PriceLabsApiKeyCard({
  overview,
  canManage,
  embedded = false,
}: PriceLabsApiKeyCardProps) {
  const { credentials, config } = overview;
  const [expanded, setExpanded] = useState(!config.configured);
  const [showKey, setShowKey] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [editing, setEditing] = useState(
    !credentials.hasStoredKey || credentials.decryptFailed,
  );
  const [pending, startTransition] = useTransition();

  const onSave = () => {
    const trimmed = apiKey.trim();
    if (trimmed.length < 8) {
      toast.error("La API key debe tener al menos 8 caracteres");
      return;
    }
    startTransition(async () => {
      try {
        const result = await savePriceLabsApiKeyAction(trimmed);
        if (result.ok) {
          toast.success(result.message);
          setApiKey("");
          setEditing(false);
        } else {
          toast.error(result.message);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error inesperado");
      }
    });
  };

  const onRevoke = () => {
    if (!window.confirm("¿Revocar la API key almacenada?")) return;
    startTransition(async () => {
      try {
        const result = await revokePriceLabsApiKeyAction();
        if (result.ok) {
          toast.success(result.message);
          setEditing(true);
        } else {
          toast.error(result.message);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error inesperado");
      }
    });
  };

  return (
    <div
      className={cn(
        embedded ? "space-y-0" : "rounded-lg border border-border bg-card",
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-muted/20"
      >
        <div className="flex min-w-0 items-center gap-2">
          <KeyRound className="h-4 w-4 shrink-0 text-pragma-electric" />
          <div className="min-w-0">
            <p className="text-sm font-medium">Conexión API</p>
            <p className="truncate text-xs text-foreground/70">
              {credentialStatusLabels[credentials.status]}
              {credentials.keyHint ? ` · ${credentials.keyHint}` : ""}
              {config.liveApiEnabled ? " · Live" : " · Simulación"}
            </p>
          </div>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-foreground/70 transition",
            expanded && "rotate-180",
          )}
        />
      </button>

      {expanded ? (
        <div className="space-y-3 border-t border-border/60 px-3 py-3 text-sm">
          {credentials.decryptFailed ? (
            <p className="rounded-md border border-warning/40 bg-warning/10 px-2.5 py-2 text-xs text-warning">
              No se puede descifrar la key guardada. Pégala de nuevo.
            </p>
          ) : null}

          <p className="text-xs text-foreground/70">
            PriceLabs → Account Settings → API Details. Header{" "}
            <code className="rounded bg-muted px-1">X-API-Key</code>.
          </p>

          {canManage ? (
            credentials.hasStoredKey && !editing ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  disabled={pending}
                  onClick={() => setEditing(true)}
                >
                  Cambiar key
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-destructive hover:text-destructive"
                  disabled={pending}
                  onClick={onRevoke}
                >
                  Revocar
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Input
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Pega tu Customer API key"
                    className="h-8 pr-9 font-mono text-xs"
                    autoComplete="off"
                    disabled={pending}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    className="absolute top-1/2 right-2 -translate-y-1/2 text-foreground/70"
                  >
                    {showKey ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={pending || apiKey.trim().length < 8}
                    onClick={onSave}
                  >
                    Guardar y conectar
                  </Button>
                  {credentials.hasStoredKey ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      disabled={pending}
                      onClick={() => {
                        setApiKey("");
                        setEditing(false);
                      }}
                    >
                      Cancelar
                    </Button>
                  ) : null}
                </div>
              </div>
            )
          ) : (
            <p className="text-xs text-foreground/70">
              Solo admins pueden configurar la API key.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
