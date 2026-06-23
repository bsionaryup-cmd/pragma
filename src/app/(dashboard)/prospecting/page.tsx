import { redirect } from "next/navigation";
import { ModuleShellFlow } from "@/components/layout/module-shell";
import { BackLink } from "@/components/ui/back-link";
import { ProspectingView } from "@/features/prospecting/components/prospecting-view";
import { requirePermission } from "@/lib/auth";
import { isApifyConfigured } from "@/lib/apify/apify-client";
import { requireTenantContext } from "@/lib/platform/tenant-context";
import { listProspectingLeads } from "@/services/prospecting/prospecting-lead.service";

type ProspectingPageProps = {
  searchParams: Promise<{ page?: string }>;
};

export default async function ProspectingPage({ searchParams }: ProspectingPageProps) {
  await requirePermission("integrations:read");
  const tenant = await requireTenantContext();

  if (!tenant.organizationId) {
    redirect("/onboarding");
  }

  const params = await searchParams;
  const page = Number(params.page ?? "1");
  const result = await listProspectingLeads({
    organizationId: tenant.organizationId,
    page: Number.isFinite(page) ? page : 1,
  });

  return (
    <ModuleShellFlow className="bg-background px-4 py-6 pb-10 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <BackLink href="/panel" label="Panel" />
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-pragma-electric">
            Growth Engine
          </p>
          <h1 className="font-heading mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Prospecting
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground/75">
            Busca empresas con Apify, normaliza los datos y construye tu base comercial por
            organización.
          </p>
        </header>

        <ProspectingView
          initialLeads={result.items}
          page={result.page}
          totalPages={result.totalPages}
          total={result.total}
          apifyConfigured={isApifyConfigured()}
        />
      </div>
    </ModuleShellFlow>
  );
}
