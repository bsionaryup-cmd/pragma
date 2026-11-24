"use client";

import dynamic from "next/dynamic";

const ClerkSessionKeepAlive = dynamic(
  () =>
    import("@/components/providers/clerk-session-keepalive").then((m) => ({
      default: m.ClerkSessionKeepAlive,
    })),
  { ssr: false },
);

export function ClerkSessionKeepAliveLazy() {
  return <ClerkSessionKeepAlive />;
}
