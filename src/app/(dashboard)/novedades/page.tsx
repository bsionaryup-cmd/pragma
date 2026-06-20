import { NovedadesPageView } from "@/features/novedades/components/novedades-page-view";
import { ModuleShellFill } from "@/components/layout/module-shell";
import { requirePermission } from "@/lib/auth";
import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";
import {
  getNovedadesInboxSnapshot,
} from "@/services/novedades/novedades-inbox.service";
import { getLatestOperationalFeedTimestamp } from "@/services/novedades/operational-feed.service";

type NovedadesPageProps = {
  searchParams: Promise<{ reservation?: string; inquiry?: string }>;
};

export default async function NovedadesPage({ searchParams }: NovedadesPageProps) {
  await requirePermission("reservations:read");
  const scope = await requireTenantDataScope();
  const scopeKey = scope.organizationId ?? scope.userId;
  const params = await searchParams;

  const [snapshot, latest] = await Promise.all([
    getNovedadesInboxSnapshot(scope),
    getLatestOperationalFeedTimestamp(scope),
  ]);

  const reservationId = params.reservation ?? null;
  const inquiryId = params.inquiry ?? null;
  const validSelectedId =
    reservationId &&
    snapshot.items.some((item) => item.reservationId === reservationId)
      ? reservationId
      : null;
  const validSelectedInquiryId =
    inquiryId &&
    snapshot.unlinkedInquiries.some((item) => item.pendingActivityId === inquiryId)
      ? inquiryId
      : null;

  return (
    <ModuleShellFill>
      <NovedadesPageView
        items={snapshot.items}
        unlinkedInquiries={snapshot.unlinkedInquiries}
        scopeKey={scopeKey}
        latestAt={latest.latestAt ?? snapshot.latestAt}
        initialSelectedId={validSelectedId}
        initialSelectedInquiryId={validSelectedInquiryId}
      />
    </ModuleShellFill>
  );
}
