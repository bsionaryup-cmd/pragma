"use client";

import { useEffect } from "react";
import { installClientErrorCapture } from "@/lib/client/client-diagnostics";

export function ClientDiagnosticsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    installClientErrorCapture();
  }, []);
  return children;
}
