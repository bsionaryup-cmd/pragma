"use client";

import dynamic from "next/dynamic";

const AirbnbAutoSync = dynamic(
  () =>
    import("@/components/airbnb/airbnb-auto-sync").then((m) => ({
      default: m.AirbnbAutoSync,
    })),
  { ssr: false },
);

type AirbnbAutoSyncLazyProps = {
  enabled: boolean;
};

/** Client boundary: defers Airbnb sync bundle until after hydration. */
export function AirbnbAutoSyncLazy({ enabled }: AirbnbAutoSyncLazyProps) {
  return <AirbnbAutoSync enabled={enabled} />;
}
