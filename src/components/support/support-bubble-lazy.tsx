"use client";

import dynamic from "next/dynamic";

const SupportBubble = dynamic(
  () =>
    import("@/components/support/support-bubble").then((m) => ({
      default: m.SupportBubble,
    })),
  { ssr: false },
);

type SupportBubbleLazyProps = {
  routeContext?: string;
  propertyId?: string;
  reservationId?: string;
};

export function SupportBubbleLazy(props: SupportBubbleLazyProps) {
  return <SupportBubble {...props} />;
}
