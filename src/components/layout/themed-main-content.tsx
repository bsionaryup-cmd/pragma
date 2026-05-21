"use client";

import { useLayoutEffect, useRef } from "react";

import { useTheme } from "@/components/providers/theme-provider";
import { cn } from "@/lib/utils";

type ThemedMainContentProps = {
  children: React.ReactNode;
};

export function ThemedMainContent({ children }: ThemedMainContentProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme, registerContentRoot } = useTheme();

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
      data-theme={resolvedTheme}
      className={cn(
        "relative flex min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground",
        resolvedTheme === "dark" && "dark",
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
    </div>
  );
}
