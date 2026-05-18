"use client";

import {
  ThemeProvider,
  type ResolvedTheme,
  type Theme,
} from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { useMounted } from "@/hooks/use-mounted";

type AppProvidersProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  defaultResolved?: ResolvedTheme;
};

export function AppProviders({
  children,
  defaultTheme = "system",
  defaultResolved = "light",
}: AppProvidersProps) {
  const mounted = useMounted();

  return (
    <ThemeProvider
      defaultTheme={defaultTheme}
      defaultResolved={defaultResolved}
    >
      {children}
      {mounted ? (
        <Toaster richColors closeButton position="top-right" />
      ) : null}
    </ThemeProvider>
  );
}
