"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { isPublishableKey } from "@clerk/shared/keys";
import { ClerkErrorBoundary } from "@/components/providers/clerk-error-boundary";
import { getClerkAllowedDevOrigins } from "@/lib/clerk-dev-origins";
import { pragmaClerkAppearance } from "@/lib/clerk-appearance";

type ClerkRootProviderProps = {
  children: React.ReactNode;
};

const publishableKey =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() ?? "";

export function ClerkRootProvider({ children }: ClerkRootProviderProps) {
  if (!isPublishableKey(publishableKey)) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[clerk] NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is missing or invalid; rendering without ClerkProvider.",
      );
    }
    return children;
  }

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      dynamic
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      afterSignOutUrl="/sign-in?signed_out=1"
      allowedRedirectOrigins={getClerkAllowedDevOrigins()}
      appearance={pragmaClerkAppearance}
    >
      <ClerkErrorBoundary>{children}</ClerkErrorBoundary>
    </ClerkProvider>
  );
}