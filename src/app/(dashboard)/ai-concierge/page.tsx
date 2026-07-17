import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";
import {
  getConciergeDashboard,
  getOrCreateConciergeConfiguration,
} from "@/modules/ai-concierge/channel/operational-state";
import { AiConciergeDashboard } from "@/components/ai-concierge/ai-concierge-dashboard";
import { PLANNED_READ_TOOLS } from "@/modules/ai-concierge/tools/registry";
import { PLANNED_WRITE_TOOLS } from "@/modules/ai-concierge/tools/write/catalog";

export default async function AiConciergePage() {
  const [auth, scope] = await Promise.all([
    requirePermission("concierge:read"),
    requireTenantDataScope(),
  ]);
  if (!scope.organizationId) {
    throw new Error("AI Concierge requiere una organización activa");
  }
  await getOrCreateConciergeConfiguration({
    organizationId: scope.organizationId,
    userId: auth.dbUserId,
  });
  const [dashboard, properties] = await Promise.all([
    getConciergeDashboard(scope.organizationId),
    db.property.findMany({
      where: { organizationId: scope.organizationId, status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <AiConciergeDashboard
      initialDashboard={JSON.parse(JSON.stringify(dashboard))}
      extensionId={process.env.NEXT_PUBLIC_CONCIERGE_EXTENSION_ID?.trim() ?? ""}
      properties={properties}
      tools={[...PLANNED_READ_TOOLS, ...PLANNED_WRITE_TOOLS].map((tool) => ({
        name: tool.name,
        description: tool.description,
        risk: tool.risk,
      }))}
    />
  );
}
