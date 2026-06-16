"use client";

import { useTheme } from "@/components/providers/theme-provider";
import { cn } from "@/lib/utils";

type ThemedMainContentProps = {
  children: React.ReactNode;
};

export function ThemedMainContent({ children }: ThemedMainContentProps) {
  const { resolvedTheme } = useTheme();

  return (
    <div
      id="pragma-main-content"
      data-theme={resolvedTheme}
      className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground"
    >
      <div
        id="pragma-main-scroll"
        className="pragma-scrollbar flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain"
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  );
}
