"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useTransition } from "react";
import { CreditCard } from "lucide-react";
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

/** Secciones enlazables vía `/settings?tab=profile|preferences|appearance` */
export const SETTINGS_TABS = ["profile", "preferences", "appearance"] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];

function isSettingsTab(value: string | null): value is SettingsTab {
  return (
    value !== null &&
    (SETTINGS_TABS as readonly string[]).includes(value)
  );
}

type SettingsViewProps = {
  email: string;
  displayName: string;
  initialLocale: string;
  initialTheme: string;
  canManageBilling?: boolean;
};

export function SettingsView({
  email,
  displayName,
  initialLocale,
  initialTheme,
  canManageBilling = false,
}: SettingsViewProps) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab");

  useEffect(() => {
    if (!isSettingsTab(activeTab)) return;
    const section = document.getElementById(activeTab);
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [activeTab]);

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

      {canManageBilling ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("nav.billing")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Plan de suscripción, facturas y métodos de pago de tu cuenta PRAGMA.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/settings/billing" className="inline-flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                {t("nav.billing")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">General</CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          <section
            id="profile"
            className="scroll-mt-6 space-y-4"
            aria-label="Perfil"
          >
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

          <section
            id="preferences"
            className="scroll-mt-6 space-y-4"
            aria-label="Preferencias"
          >
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

          <section
            id="appearance"
            className="scroll-mt-6 space-y-4"
            aria-label="Apariencia"
          >
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
