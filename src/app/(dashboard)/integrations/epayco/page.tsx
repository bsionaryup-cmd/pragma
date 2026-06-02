import { ModuleShellFlow } from "@/components/layout/module-shell";
import { BackLink } from "@/components/ui/back-link";
import { TenantEpaycoPanel } from "@/features/integrations/epayco/components/tenant-epayco-panel";
import { getTenantEpaycoStatusAction } from "@/features/integrations/epayco/actions/tenant-epayco.actions";
import { hasPermission, requirePermission } from "@/lib/auth";
import type { AppUserRole } from "@/types/auth";

export default async function TenantEpaycoPage() {
  const auth = await requirePermission("integrations:read");
  const { snapshot } = await getTenantEpaycoStatusAction();
  const canManage = hasPermission(auth.role as AppUserRole, "integrations:manage");

  return (
    <ModuleShellFlow className="bg-background px-4 py-6 pb-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <BackLink href="/integrations" label="Integraciones" />
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-pragma-electric">
            Integraciones
          </p>
          <h1 className="font-heading mt-2 text-2xl font-semibold">ePayco · Payment Links</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Conecta ePayco para cobrar huéspedes con checkout seguro. Compatible con tarjeta, PSE y
            otros medios habilitados en tu comercio ePayco.
          </p>
        </header>
        {snapshot ? (
          <TenantEpaycoPanel snapshot={snapshot} canManage={canManage} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Crea o únete a una organización para configurar ePayco.
          </p>
        )}
      </div>
    </ModuleShellFlow>
  );
}
