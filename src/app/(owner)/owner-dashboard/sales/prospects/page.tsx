import { redirect } from "next/navigation";
import { ProspectsView } from "@/components/sales-console/prospects-view";
import { SalesConsoleSectionShell } from "@/components/sales/sales-console-section-shell";
import { serializeProspectRow } from "@/features/sales-console/types/prospect";
import {
  PlatformOwnerForbiddenError,
  requirePlatformOwnerUser,
} from "@/lib/platform/require-platform-owner";
import { isOpenAiEnrichmentConfigured } from "@/modules/sales-console/enrichment/openai-sales.client";
import { isApifyProspectingConfigured } from "@/modules/sales-console/prospecting/apify-prospecting.client";
import { listProspects } from "@/modules/sales-console/services/prospect.service";

type OwnerSalesProspectsPageProps = {
  searchParams: Promise<{ archived?: string }>;
};

export default async function OwnerSalesProspectsPage({
  searchParams,
}: OwnerSalesProspectsPageProps) {
  try {
    await requirePlatformOwnerUser();
  } catch (error) {
    if (error instanceof PlatformOwnerForbiddenError) {
      redirect("/unauthorized");
    }
    throw error;
  }

  const params = await searchParams;
  const includeArchived = params.archived === "1";
  const prospects = await listProspects({ includeArchived });

  return (
    <SalesConsoleSectionShell activeSection="prospects" sectionTitle="Prospectos">
      <ProspectsView
        initialProspects={prospects.map(serializeProspectRow)}
        includeArchived={includeArchived}
        apifyConfigured={isApifyProspectingConfigured()}
        openAiConfigured={isOpenAiEnrichmentConfigured()}
      />
    </SalesConsoleSectionShell>
  );
}
