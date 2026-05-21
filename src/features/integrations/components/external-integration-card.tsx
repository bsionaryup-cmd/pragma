"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  saveExternalIntegrationAction,
  testExternalIntegrationAction,
} from "@/features/integrations/actions/external-integration.actions";
import type { ExternalIntegrationProvider } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ExternalIntegrationCardProps = {
  provider: ExternalIntegrationProvider;
  title: string;
  description: string;
  integration: {
    clientId: string | null;
    callbackUrl: string | null;
    status: string;
    lastError: string | null;
    hasApiKey: boolean;
    hasSecret: boolean;
  } | null;
};

export function ExternalIntegrationCard({
  provider,
  title,
  description,
  integration,
}: ExternalIntegrationCardProps) {
  const [pending, startTransition] = useTransition();
  const [testMsg, setTestMsg] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>{title}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <Badge variant={integration?.status === "CONNECTED" ? "default" : "outline"}>
          {integration?.status ?? "NOT_CONNECTED"}
        </Badge>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-3 sm:grid-cols-2"
          action={(fd) => {
            startTransition(async () => {
              try {
                await saveExternalIntegrationAction(provider, fd);
                toast.success("Credenciales guardadas");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Error al guardar");
              }
            });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor={`${provider}-clientId`}>Client ID</Label>
            <Input
              id={`${provider}-clientId`}
              name="clientId"
              defaultValue={integration?.clientId ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${provider}-apiKey`}>API Key</Label>
            <Input
              id={`${provider}-apiKey`}
              name="apiKey"
              type="password"
              placeholder={integration?.hasApiKey ? "Guardado" : ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${provider}-secret`}>Client Secret</Label>
            <Input
              id={`${provider}-secret`}
              name="clientSecret"
              type="password"
              placeholder={integration?.hasSecret ? "Guardado" : ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${provider}-token`}>Token</Label>
            <Input id={`${provider}-token`} name="token" type="password" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor={`${provider}-callback`}>Callback URL</Label>
            <Input
              id={`${provider}-callback`}
              name="callbackUrl"
              defaultValue={integration?.callbackUrl ?? ""}
            />
          </div>
          {integration?.lastError ? (
            <p className="sm:col-span-2 text-sm text-destructive">{integration.lastError}</p>
          ) : null}
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="submit" disabled={pending}>
              Guardar
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await testExternalIntegrationAction(provider);
                  setTestMsg(result.message);
                  toast[result.ok ? "success" : "error"](result.message);
                })
              }
            >
              Probar conexión
            </Button>
          </div>
          {testMsg ? (
            <p className="text-xs text-muted-foreground sm:col-span-2">{testMsg}</p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
