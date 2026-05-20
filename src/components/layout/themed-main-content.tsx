"use client";

import { useLayoutEffect, useRef } from "react";

import {
  type ResolvedTheme,
  useTheme,
} from "@/components/providers/theme-provider";
import { ThemeModeButton } from "@/components/layout/theme-mode-button";
import { cn } from "@/lib/utils";

type ThemedMainContentProps = {
  children: React.ReactNode;
  initialResolved?: ResolvedTheme;
};

export function ThemedMainContent({
  children,
  initialResolved = "light",
}: ThemedMainContentProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { resolvedTheme, registerContentRoot } = useTheme();
  const resolved = resolvedTheme ?? initialResolved;

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    registerContentRoot(element);
    return () => registerContentRoot(null);
  }, [registerContentRoot]);

  return (
    <div
      ref={ref}
      id="pragma-main-content"
      data-theme={resolved}
      className={cn(
        "relative flex min-w-0 flex-1 flex-col overflow-hidden bg-background text-foreground",
        resolved === "dark" && "dark",
      )}
    >
      <div className="pointer-events-none absolute right-4 bottom-4 z-40">
        <div className="pointer-events-auto">
          <ThemeModeButton />
        </div>
      </div>
      {children}
    </div>
  );
}
