import dynamic from "next/dynamic";
import { Suspense } from "react";
import { ModuleShellFlow } from "@/components/layout/module-shell";
import { hasPermission, requireDbUser } from "@/lib/auth";
import type { AppUserRole } from "@/types/auth";
import { getUserDisplayName } from "@/lib/helpers/user-display";
import SettingsLoading from "./loading";

const SettingsView = dynamic(
  () =>
    import("@/components/settings/settings-view").then((m) => ({
      default: m.SettingsView,
    })),
  { loading: () => <SettingsLoading /> },
);

export default async function SettingsPage() {
  const user = await requireDbUser();
  const canManageBilling = hasPermission(
    user.role as AppUserRole,
    "billing:manage",
  );

  return (
    <ModuleShellFlow className="bg-background">
      <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Cargando…</div>}>
        <SettingsView
          email={user.email}
          displayName={getUserDisplayName(
            user.firstName,
            user.lastName,
            user.email,
          )}
          initialLocale={user.locale}
          initialTheme={user.theme}
          canManageBilling={canManageBilling}
        />
      </Suspense>
    </ModuleShellFlow>
  );
}
