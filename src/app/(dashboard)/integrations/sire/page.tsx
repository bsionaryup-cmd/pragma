import { ExternalIntegrationCard } from "@/features/integrations/components/external-integration-card";
import { getExternalIntegrationOverview } from "@/features/integrations/actions/external-integration.actions";
import { ModuleShellFlow } from "@/components/layout/module-shell";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth";

export default async function SireIntegrationPage() {
  await requirePermission("integrations:manage");
  const integration = await getExternalIntegrationOverview("SIRE");

  return (
    <ModuleShellFlow className="bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader
          eyebrow="Integraciones"
          title="SIRE"
          description="Reporte de huéspedes — configuración lista para conectar API oficial."
        />
        <ExternalIntegrationCard
          provider="SIRE"
          title="SIRE Colombia"
          description="Credenciales y token para envío de reportes de alojamiento."
          integration={integration}
        />
      </div>
    </ModuleShellFlow>
  );
}
