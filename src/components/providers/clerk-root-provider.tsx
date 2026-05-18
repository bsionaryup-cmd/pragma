"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { ClerkErrorBoundary } from "@/components/providers/clerk-error-boundary";

const LOCAL_DEV_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  "http://localhost:3003",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "http://127.0.0.1:3002",
  "http://127.0.0.1:3003",
];

type ClerkRootProviderProps = {
  children: React.ReactNode;
};

export function ClerkRootProvider({ children }: ClerkRootProviderProps) {
  return (
    <ClerkProvider dynamic allowedRedirectOrigins={LOCAL_DEV_ORIGINS}>
      <ClerkErrorBoundary>{children}</ClerkErrorBoundary>
    </ClerkProvider>
  );
}
