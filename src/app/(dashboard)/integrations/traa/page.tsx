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
          description="Turismo registrado — estructura de conexión preparada para producción."
        />
        <ExternalIntegrationCard
          provider="TRAA"
          title="TRAA"
          description="API Key, token y callback para validación con la plataforma."
          integration={integration}
        />
      </div>
    </ModuleShellFlow>
  );
}
