"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { ClerkErrorBoundary } from "@/components/providers/clerk-error-boundary";
import { getClerkAllowedDevOrigins } from "@/lib/clerk-dev-origins";
import { pragmaClerkAppearance } from "@/lib/clerk-appearance";

type ClerkRootProviderProps = {
  children: React.ReactNode;
};

/**
 * In production, route ClerkJS + FAPI through same-origin `/__clerk` so login
 * does not depend on clerk.pragmapms.com SSL (which can fail while DNS CNAME
 * already points at frontend-api.clerk.services).
 *
 * Prefer absolute apex URL when configured — Clerk Production domain is
 * pragmapms.com (not www), and proxy_url must match that domain.
 */
function resolveClerkProxyUrl(): string | undefined {
  const fromEnv = process.env.NEXT_PUBLIC_CLERK_PROXY_URL?.trim();
  if (fromEnv) return fromEnv;
  // Relative same-origin proxy on www.pragmapms.com (Vercel primary host).
  if (process.env.NODE_ENV === "production") return "/__clerk";
  return undefined;
}

export function ClerkRootProvider({ children }: ClerkRootProviderProps) {
  const proxyUrl = resolveClerkProxyUrl();

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
