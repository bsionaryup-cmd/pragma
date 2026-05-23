"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useI18n } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { PRAGMA_TIMEZONE } from "@/lib/timezone";
import { saveUserPreferencesAction } from "@/features/settings/actions/settings.actions";

type SettingsViewProps = {
  canAccessIntegrations: boolean;
  canManageUsers: boolean;
  canManageBilling: boolean;
  email: string;
  displayName: string;
  initialLocale: string;
  initialTheme: string;
};

export function SettingsView({
  canAccessIntegrations,
  canManageUsers,
  canManageBilling,
  email,
  displayName,
  initialLocale,
  initialTheme,
}: SettingsViewProps) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();

  function persistPreferences() {
    startTransition(async () => {
      try {
        await saveUserPreferencesAction({
          locale: document.documentElement.lang || initialLocale,
          theme: initialTheme,
        });
        toast.success("Preferencias guardadas");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "No se pudo guardar",
        );
      }
    });
  }

  const hasQuickLinks =
    canAccessIntegrations || canManageBilling || canManageUsers;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 pb-12 sm:px-6 lg:px-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-pragma-electric">
          {t("settings.title")}
        </p>
        <h1 className="font-heading mt-2 text-2xl font-semibold text-foreground">
          Configuración del sistema
        </h1>
      </div>

      {hasQuickLinks ? (
        <div className="flex flex-wrap gap-2 border-b border-border pb-2">
          {canManageBilling ? (
            <Link
              href="/settings/billing"
              className="rounded-lg bg-pragma-soft-cyan px-3 py-1.5 text-sm font-medium text-pragma-electric ring-1 ring-pragma-cyan/20"
            >
              Facturación
            </Link>
          ) : null}
          {canAccessIntegrations ? (
            <Link
              href="/integrations"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted"
            >
              {t("nav.integrations")}
            </Link>
          ) : null}
          {canManageUsers ? (
            <Link
              href="/users"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted"
            >
              {t("nav.users")}
            </Link>
          ) : null}
        </div>
      ) : null}

      {canManageBilling ? (
        <Card className="border-pragma-soft-cyan/30 bg-pragma-soft-cyan/10">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div>
              <p className="text-sm font-semibold text-foreground">
                Suscripción y facturas
              </p>
              <p className="text-xs text-muted-foreground">
                Consulta tu plan, paga tu suscripción y descarga facturas.
              </p>
            </div>
            <Button asChild size="sm">
              <Link href="/settings/billing">Abrir facturación</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">General</CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          <section className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Perfil</h2>
              <p className="text-xs text-muted-foreground">
                Información de tu cuenta en PRAGMA.
              </p>
            </div>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-muted/20 px-4 py-3">
                <dt className="text-xs text-muted-foreground">Nombre</dt>
                <dd className="mt-1 text-sm font-medium">{displayName}</dd>
              </div>
              <div className="rounded-xl border border-border bg-muted/20 px-4 py-3">
                <dt className="text-xs text-muted-foreground">Email</dt>
                <dd className="mt-1 text-sm font-medium">{email}</dd>
              </div>
            </dl>
          </section>

          <Separator />

          <section className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Preferencias
              </h2>
              <p className="text-xs text-muted-foreground">
                Idioma y zona horaria de la operación.
              </p>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Idioma</Label>
                <LanguageSwitcher collapsed={false} />
              </div>
              <div className="space-y-2">
                <Label>Zona horaria del sistema</Label>
                <p className="rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm">
                  {PRAGMA_TIMEZONE} (fija para toda la operación)
                </p>
              </div>
            </div>
          </section>

          <Separator />

          <section className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Apariencia
              </h2>
              <p className="text-xs text-muted-foreground">
                Tema visual de la interfaz.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Tema</Label>
              <ThemeToggle />
              <p className="text-xs text-muted-foreground">
                Claro, oscuro o según el sistema. Se guarda en tu perfil.
              </p>
            </div>
          </section>

          <div className="pt-2">
            <Button type="button" disabled={pending} onClick={persistPreferences}>
              Guardar preferencias
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
