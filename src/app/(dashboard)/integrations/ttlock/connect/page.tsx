import { ModuleShellFlow } from "@/components/layout/module-shell";
import { BackLink } from "@/components/ui/back-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { completeTTLockConnectAction } from "@/features/integrations/ttlock/actions/ttlock.actions";
import { requireTTLockAdmin } from "@/lib/auth/ttlock-admin";
import { buildTTLockConnectSession } from "@/services/integrations/ttlock/ttlock.service";

type TTLockConnectPageProps = {
  searchParams: Promise<{ state?: string; error?: string }>;
};

export default async function TTLockConnectPage({
  searchParams,
}: TTLockConnectPageProps) {
  const user = await requireTTLockAdmin();
  const params = await searchParams;
  const error = params.error?.trim();
  const state =
    params.state?.trim() || (await buildTTLockConnectSession(user.dbUserId)).state;

  return (
    <ModuleShellFlow className="bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-lg space-y-6">
        <BackLink href="/integrations/ttlock" label="TTLock" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            TTLock — Conexión de cuenta
          </p>
          <h1 className="mt-2 text-2xl font-semibold">Autorizar cuenta TTLock</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Inicia sesión con la cuenta de la app TTLock (no la de desarrollador)
            para vincular tus cerraduras a PRAGMA.
          </p>
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
              <input type="hidden" name="state" value={state} />
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
              <Button type="submit">Completar conexión</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </ModuleShellFlow>
  );
}
