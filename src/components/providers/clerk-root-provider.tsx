"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { ClerkErrorBoundary } from "@/components/providers/clerk-error-boundary";
import { getClerkAllowedDevOrigins } from "@/lib/clerk-dev-origins";
import { pragmaClerkAppearance } from "@/lib/clerk-appearance";

type ClerkRootProviderProps = {
  children: React.ReactNode;
};

export function ClerkRootProvider({ children }: ClerkRootProviderProps) {
  return (
    <ClerkProvider
      dynamic
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      afterSignOutUrl="/sign-in"
      allowedRedirectOrigins={getClerkAllowedDevOrigins()}
      appearance={pragmaClerkAppearance}
    >
      <ClerkErrorBoundary>{children}</ClerkErrorBoundary>
    </ClerkProvider>
  );
}
