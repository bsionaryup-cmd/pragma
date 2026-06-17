import { NovedadesPageView } from "@/features/novedades/components/novedades-page-view";
import { requirePermission } from "@/lib/auth";
import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";
import { listNovedadesFeedForTenant, getLatestOperationalFeedTimestamp } from "@/services/novedades/operational-feed.service";

export default async function NovedadesPage() {
  await requirePermission("reservations:read");
  const scope = await requireTenantDataScope();
  const scopeKey = scope.organizationId ?? scope.userId;
  const [feed, latest] = await Promise.all([
    listNovedadesFeedForTenant(scope),
    getLatestOperationalFeedTimestamp(scope),
  ]);

  return (
    <NovedadesPageView
      feed={feed}
      scopeKey={scopeKey}
      latestAt={latest.latestAt}
    />
  );
}
