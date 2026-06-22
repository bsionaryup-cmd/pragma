import { redirect } from "next/navigation";
import { PipelineView } from "@/components/sales-console/pipeline-view";
import { SalesConsoleSectionShell } from "@/components/sales/sales-console-section-shell";
import { serializeProspectRow } from "@/features/sales-console/types/prospect";
import {
  PlatformOwnerForbiddenError,
  requirePlatformOwnerUser,
} from "@/lib/platform/require-platform-owner";
import { listProspects } from "@/modules/sales-console/services/prospect.service";

export default async function OwnerSalesPipelinePage() {
  try {
    await requirePlatformOwnerUser();
  } catch (error) {
    if (error instanceof PlatformOwnerForbiddenError) {
      redirect("/unauthorized");
    }
    throw error;
  }

  const prospects = await listProspects({ includeArchived: true });

  return (
    <SalesConsoleSectionShell activeSection="pipeline" sectionTitle="Pipeline">
      <PipelineView prospects={prospects.map(serializeProspectRow)} />
    </SalesConsoleSectionShell>
  );
}
