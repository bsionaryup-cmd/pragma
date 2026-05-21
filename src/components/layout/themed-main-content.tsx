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
  const outerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme, registerContentRoot } = useTheme();
  const resolved = resolvedTheme ?? initialResolved;

  useLayoutEffect(() => {
    const element = outerRef.current;
    if (!element) return;

    registerContentRoot(element);
    return () => registerContentRoot(null);
  }, [registerContentRoot]);

  return (
    <div
      ref={outerRef}
      id="pragma-main-content"
      data-theme={resolved}
      className={cn(
        "relative flex min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground",
        resolved === "dark" && "dark",
      )}
    >
      <div
        ref={scrollRef}
        id="pragma-main-scroll"
        className="pragma-scrollbar flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain"
        tabIndex={-1}
      >
        {children}
      </div>

      <div className="pointer-events-none absolute right-4 bottom-4 z-40">
        <div className="pointer-events-auto">
          <ThemeModeButton />
        </div>
      </div>
    </div>
  );
}
