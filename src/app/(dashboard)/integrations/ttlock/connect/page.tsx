import Link from "next/link";
import { ModuleShellFlow } from "@/components/layout/module-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { completeTTLockConnectAction } from "@/features/integrations/ttlock/actions/ttlock.actions";
import { requireTTLockAdmin } from "@/lib/auth/ttlock-admin";
import { resolveTTLockRedirectUri } from "@/lib/integrations/ttlock-config";
import { ensureTTLockIntegration } from "@/services/integrations/ttlock.service";

type TTLockConnectPageProps = {
  searchParams: Promise<{ state?: string; error?: string }>;
};

export default async function TTLockConnectPage({
  searchParams,
}: TTLockConnectPageProps) {
  const user = await requireTTLockAdmin();
  const params = await searchParams;
  const state = params.state?.trim() ?? "";
  const error = params.error?.trim();

  const integration = await ensureTTLockIntegration(user.dbUserId);
  const resolved = resolveTTLockRedirectUri({
    storedRedirectUri: integration.redirectUri,
  });
  const callbackUrl =
    resolved.validation.normalizedUrl ?? resolved.redirectUri;

  return (
    <ModuleShellFlow className="bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-lg space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            TTLock — Conexión de cuenta
          </p>
          <h1 className="mt-2 text-2xl font-semibold">Autorizar cuenta TTLock</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Usa la cuenta de la app TTLock (no la de desarrollador). El{" "}
            <code className="rounded bg-muted px-1 text-xs">redirect_uri</code> debe
            coincidir con el portal:
          </p>
          {callbackUrl ? (
            <code className="mt-2 block break-all rounded-lg bg-muted px-3 py-2 text-xs">
              {callbackUrl}
            </code>
          ) : (
            <p className="mt-2 text-sm text-destructive">
              Configura TTLOCK_REDIRECT_URI o APP_URL pública antes de conectar.
            </p>
          )}
        </div>

        {error ? (
          <p className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Cuenta TTLock</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={completeTTLockConnectAction} className="space-y-4">
              {state ? <input type="hidden" name="state" value={state} /> : null}
              <div className="space-y-2">
                <Label htmlFor="username">Usuario TTLock</Label>
                <Input
                  id="username"
                  name="username"
                  required
                  autoComplete="username"
                  placeholder="Cuenta de la app TTLock"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña TTLock</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={!resolved.validation.valid}>
                  Completar conexión
                </Button>
                <Button asChild variant="outline">
                  <Link href="/integrations/ttlock">Volver</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </ModuleShellFlow>
  );
}
