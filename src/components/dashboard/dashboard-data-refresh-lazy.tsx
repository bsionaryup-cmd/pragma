"use client";

import dynamic from "next/dynamic";

const DashboardDataRefresh = dynamic(
  () =>
    import("@/components/dashboard/dashboard-data-refresh").then((m) => ({
      default: m.DashboardDataRefresh,
    })),
  { ssr: false },
);

type DashboardDataRefreshLazyProps = {
  enabled?: boolean;
};

export function DashboardDataRefreshLazy({
  enabled = true,
}: DashboardDataRefreshLazyProps) {
  return <DashboardDataRefresh enabled={enabled} />;
}
