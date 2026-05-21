"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useI18n } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { PRAGMA_TIMEZONE } from "@/lib/timezone";
import { saveUserPreferencesAction } from "@/features/settings/actions/settings.actions";

type SettingsViewProps = {
  canManageUsers: boolean;
  email: string;
  displayName: string;
  initialLocale: string;
  initialTheme: string;
};

const tabs = [
  { id: "general", label: "General" },
  { id: "appearance", label: "Apariencia" },
  { id: "profile", label: "Perfil" },
] as const;

type TabId = (typeof tabs)[number]["id"];

export function SettingsView({
  canManageUsers,
  email,
  displayName,
  initialLocale,
  initialTheme,
}: SettingsViewProps) {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const activeTab = (searchParams.get("tab") as TabId) || "general";

  function setTab(tab: TabId) {
    router.replace(`/settings?tab=${tab}`, { scroll: false });
  }

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

      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setTab(tab.id)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {tab.label}
          </button>
        ))}
        {canManageUsers ? (
          <Link
            href="/users"
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            Usuarios
          </Link>
        ) : null}
      </div>

      {activeTab === "general" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">General</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
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
            <Button type="button" disabled={pending} onClick={persistPreferences}>
              Guardar preferencias
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "appearance" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Apariencia</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Tema</Label>
              <ThemeToggle />
              <p className="text-xs text-muted-foreground">
                Claro, oscuro o según el sistema. Se guarda en tu perfil.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "profile" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Perfil</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-muted-foreground">Nombre</p>
              <p className="font-medium">{displayName}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Email</p>
              <p className="font-medium">{email}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
