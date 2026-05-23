"use client";

import { useState, useTransition } from "react";
import { AlertCircle, CheckCircle2, Eye, EyeOff, KeyRound } from "lucide-react";
import { toast } from "sonner";
import {
  revokePriceLabsApiKeyAction,
  savePriceLabsApiKeyAction,
} from "@/features/integrations/pricelabs/actions/pricelabs.actions";
import type { PriceLabsOverviewDto } from "@/services/integrations/pricelabs.service";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type PriceLabsApiKeyCardProps = {
  overview: PriceLabsOverviewDto;
  canManage: boolean;
};

const credentialStatusLabels: Record<
  PriceLabsOverviewDto["credentials"]["status"],
  string
> = {
  missing: "Sin API key",
  stored: "Guardada en servidor",
  environment: "Variable de entorno",
  both: "BD + entorno (BD tiene prioridad)",
};

export function PriceLabsApiKeyCard({
  overview,
  canManage,
}: PriceLabsApiKeyCardProps) {
  const { credentials, config } = overview;
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
    if (!window.confirm("¿Revocar la API key almacenada en el servidor?")) return;
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
    <Card className="border-[#E5E7EB] bg-white shadow-sm lg:col-span-2">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4" />
          API key (Customer API)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[#6B7280]">Estado</span>
          <span
            className={cn(
              "flex items-center gap-1.5 font-medium",
              config.configured ? "text-success" : "text-warning",
            )}
          >
            {config.configured ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            {credentialStatusLabels[credentials.status]}
          </span>
        </div>

        {credentials.decryptFailed ? (
          <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
            Hay una API key guardada, pero el servidor no puede descifrarla. Pega
            la key de nuevo para restaurar la conexión.
          </p>
        ) : null}

        {credentials.keyHint ? (
          <p className="text-xs text-[#6B7280]">
            Clave activa: <span className="font-mono">{credentials.keyHint}</span>
            {credentials.hasEnvKey ? (
              <span className="ml-1 text-[#9CA3AF]">
                · también hay PRICELABS_API_KEY en entorno
              </span>
            ) : null}
          </p>
        ) : null}

        <p className="text-xs text-[#9CA3AF]">
          Obtén la key en PriceLabs → Account Settings → API Details. Header:{" "}
          <code className="rounded bg-[#F3F4F6] px-1">X-API-Key</code>. Se guarda
          cifrada; nunca se envía al navegador después de guardar.
        </p>

        {canManage ? (
          <div className="space-y-3 rounded-xl border border-[#E5E7EB] bg-[#FAFBFC] p-4">
            {credentials.hasStoredKey && !editing ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => setEditing(true)}
                >
                  Cambiar API key
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-red-600 hover:text-red-700"
                  disabled={pending}
                  onClick={onRevoke}
                >
                  Revocar
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="pricelabs-api-key">API key PriceLabs</Label>
                  <div className="relative">
                    <Input
                      id="pricelabs-api-key"
                      name="pricelabsApiKey"
                      type={showKey ? "text" : "password"}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={
                        credentials.hasStoredKey
                          ? "Pega la nueva API key"
                          : "Pega tu API key de PriceLabs"
                      }
                      className="pr-10 font-mono text-sm"
                      autoComplete="off"
                      spellCheck={false}
                      disabled={pending}
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey((v) => !v)}
                      className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-[#6B7280] hover:text-[#111827]"
                      aria-label={showKey ? "Ocultar" : "Mostrar"}
                    >
                      {showKey ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-[#9CA3AF]">
                    Puedes pegar desde el portapapeles. Se guarda cifrada en el
                    servidor.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={pending || apiKey.trim().length < 8}
                    onClick={onSave}
                  >
                    {credentials.hasStoredKey ? "Guardar y reconectar" : "Guardar y conectar"}
                  </Button>
                  {credentials.hasStoredKey ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
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
              </>
            )}
          </div>
        ) : (
          <p className="text-xs text-[#9CA3AF]">
            Solo administradores pueden configurar la API key.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
