import { Suspense } from "react";
import { ModuleShellFlow } from "@/components/layout/module-shell";
import { SettingsView } from "@/components/settings/settings-view";
import { requireDbUser } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { getUserDisplayName } from "@/lib/helpers/user-display";
import type { AppUserRole } from "@/types/auth";

export default async function SettingsPage() {
  const user = await requireDbUser();
  const role = user.role as AppUserRole;
  const canManageUsers = hasPermission(role, "users:read");

  return (
    <ModuleShellFlow className="bg-background">
      <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Cargando…</div>}>
        <SettingsView
          canManageUsers={canManageUsers}
          email={user.email}
          displayName={getUserDisplayName(
            user.firstName,
            user.lastName,
            user.email,
          )}
          initialLocale={user.locale}
          initialTheme={user.theme}
        />
      </Suspense>
    </ModuleShellFlow>
  );
}
