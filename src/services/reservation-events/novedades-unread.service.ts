import "server-only";

import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";
import { getLatestOperationalFeedTimestamp } from "@/services/novedades/operational-feed.service";

export type NovedadesUnreadSnapshot = {
  scopeKey: string;
  latestAt: string | null;
  latestId: string | null;
};

export async function getNovedadesUnreadSnapshot(): Promise<NovedadesUnreadSnapshot> {
  const scope = await requireTenantDataScope();
  const scopeKey = scope.organizationId ?? scope.userId;
  const latest = await getLatestOperationalFeedTimestamp(scope);

  return {
    scopeKey,
    latestAt: latest.latestAt,
    latestId: latest.latestId,
  };
}
