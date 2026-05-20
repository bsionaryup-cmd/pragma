"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { ClerkErrorBoundary } from "@/components/providers/clerk-error-boundary";
import { getClerkAllowedDevOrigins } from "@/lib/clerk-dev-origins";

type ClerkRootProviderProps = {
  children: React.ReactNode;
};

export function ClerkRootProvider({ children }: ClerkRootProviderProps) {
  return (
    <ClerkProvider dynamic allowedRedirectOrigins={getClerkAllowedDevOrigins()}>
      <ClerkErrorBoundary>{children}</ClerkErrorBoundary>
    </ClerkProvider>
  );
}
