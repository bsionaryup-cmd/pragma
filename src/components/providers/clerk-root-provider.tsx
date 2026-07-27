"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { ClerkErrorBoundary } from "@/components/providers/clerk-error-boundary";
import { getClerkAllowedDevOrigins } from "@/lib/clerk-dev-origins";
import { pragmaClerkAppearance } from "@/lib/clerk-appearance";
import { resolveClerkProviderProxyUrl } from "@/lib/auth/clerk-proxy-config";

type ClerkRootProviderProps = {
  children: React.ReactNode;
};

export function ClerkRootProvider({ children }: ClerkRootProviderProps) {
  const proxyUrl = resolveClerkProviderProxyUrl();

  return (
    <ClerkProvider
      dynamic
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      afterSignOutUrl="/sign-in?signed_out=1"
      allowedRedirectOrigins={getClerkAllowedDevOrigins()}
      appearance={pragmaClerkAppearance}
      {...(proxyUrl ? { proxyUrl } : {})}
    >
      <ClerkErrorBoundary>{children}</ClerkErrorBoundary>
    </ClerkProvider>
  );
}
