"use client";

import {
  ThemeProvider,
  type ResolvedTheme,
  type Theme,
} from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { ClientDiagnosticsProvider } from "@/components/providers/client-diagnostics-provider";
import { useMounted } from "@/hooks/use-mounted";

type AppProvidersProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  defaultResolved?: ResolvedTheme;
};

export function AppProviders({
  children,
  defaultTheme = "light",
  defaultResolved = "light",
}: AppProvidersProps) {
  const mounted = useMounted();

  return (
    <ThemeProvider
      defaultTheme={defaultTheme}
      defaultResolved={defaultResolved}
    >
      <ClientDiagnosticsProvider>{children}</ClientDiagnosticsProvider>
      {mounted ? (
        <Toaster richColors closeButton position="top-right" />
      ) : null}
    </ThemeProvider>
  );
}
