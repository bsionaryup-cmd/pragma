import { ExternalIntegrationCard } from "@/features/integrations/components/external-integration-card";
import { getExternalIntegrationOverview } from "@/features/integrations/actions/external-integration.actions";
import { ModuleShellFlow } from "@/components/layout/module-shell";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth";

export default async function TraaIntegrationPage() {
  await requirePermission("integrations:manage");
  const integration = await getExternalIntegrationOverview("TRAA");

  return (
    <ModuleShellFlow className="bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader
          backHref="/integrations"
          backLabel="Integraciones"
          eyebrow="Integraciones"
          title="TRAA"
          description="Tarjeta de Registro de Alojamiento (MINCIT) — la prueba valida RNT y token contra la API PMS oficial."
        />
        <ExternalIntegrationCard
          provider="TRAA"
          title="TRAA"
          description="Client ID = RNT. Token = autogestionado en pms.mincit.gov.co/token (header Authorization: token …)."
          integration={integration}
        />
      </div>
    </ModuleShellFlow>
  );
}
