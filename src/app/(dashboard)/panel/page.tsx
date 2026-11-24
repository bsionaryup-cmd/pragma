import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { requirePermission } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { getServerLocale } from "@/i18n/locale.server";
import { dashboardMetadata } from "@/lib/seo";
import { getOperationsCenterSnapshot } from "@/services/dashboard/operations-center.compose";
import { getActiveSystemAnnouncements } from "@/lib/system-announcements";
import PanelLoading from "./loading";

const CommandCenterView = dynamic(
  () =>
    import("@/components/dashboard/command-center-view").then((m) => ({
      default: m.CommandCenterView,
    })),
  { loading: () => <PanelLoading /> },
);

export const metadata: Metadata = dashboardMetadata;

export default async function PanelControlPage() {
  const locale = await getServerLocale();
  const auth = await requirePermission("dashboard:read");
  const canReadFinance = hasPermission(auth.role, "finance:read");
  const canReadAccess = hasPermission(auth.role, "access:read");

  const [snapshot, novedades] = await Promise.all([
    getOperationsCenterSnapshot({
      locale,
      canReadFinance,
      canReadAccess,
    }),
    Promise.resolve(getActiveSystemAnnouncements(locale)),
  ]);

  const canCreateProperties = hasPermission(auth.role, "properties:write");

  // Empty-org banner only when we positively know there are zero properties.
  // Never show it when finance/ops already prove the tenant is active
  // (guards against soft-fail / stale client bundles claiming "no properties").
  const knownEmpty =
    snapshot.reliablePropertyCount === 0 &&
    !snapshot.finance &&
    snapshot.attentionTotal === 0 &&
    snapshot.commandCenter.counts.current === 0 &&
    snapshot.commandCenter.todayCounts.arrivals === 0 &&
    snapshot.commandCenter.todayCounts.departures === 0;

  return (
    <CommandCenterView
      firstName={auth.firstName}
      snapshot={snapshot}
      showEmptyBanner={knownEmpty}
      canCreateProperties={canCreateProperties}
      novedades={novedades}
    />
  );
}
