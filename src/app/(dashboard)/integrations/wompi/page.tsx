import { ModuleShellFlow } from "@/components/layout/module-shell";
import { BackLink } from "@/components/ui/back-link";
import { TenantWompiPanel } from "@/features/integrations/wompi/components/tenant-wompi-panel";
import { getTenantWompiStatusAction } from "@/features/integrations/wompi/actions/tenant-wompi.actions";
import { hasPermission, requirePermission } from "@/lib/auth";
import type { AppUserRole } from "@/types/auth";

export default async function TenantWompiPage() {
  const auth = await requirePermission("integrations:read");
  const { snapshot } = await getTenantWompiStatusAction();
  const canManage = hasPermission(auth.role as AppUserRole, "integrations:manage");

  return (
    <ModuleShellFlow className="bg-background px-4 py-6 pb-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <BackLink href="/integrations" label="Integraciones" />
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-pragma-electric">
            Integraciones
          </p>
          <h1 className="font-heading mt-2 text-2xl font-semibold">Wompi · Payment Links</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Conecta la cuenta Wompi de tu operación para cobrar huéspedes. No usa la cuenta de
            facturación SaaS de PRAGMA.
          </p>
        </header>
        {snapshot ? (
          <TenantWompiPanel snapshot={snapshot} canManage={canManage} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Crea o únete a una organización para configurar Wompi.
          </p>
        )}
      </div>
    </ModuleShellFlow>
  );
}
