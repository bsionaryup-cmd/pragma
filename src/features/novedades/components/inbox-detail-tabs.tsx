"use client";

import { cn } from "@/lib/utils";

export type InboxDetailTab = "messages" | "activity";

type InboxDetailTabsProps = {
  activeTab: InboxDetailTab;
  onTabChange: (tab: InboxDetailTab) => void;
  activityCount?: number;
  className?: string;
};

export function InboxDetailTabs({
  activeTab,
  onTabChange,
  activityCount = 0,
  className,
}: InboxDetailTabsProps) {
  const tabs: { id: InboxDetailTab; label: string; count?: number }[] = [
    { id: "messages", label: "Mensajes" },
    { id: "activity", label: "Actividad", count: activityCount },
  ];

  return (
    <div className={cn("flex gap-1 border-b border-border/70 px-4", className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "relative -mb-px px-3 py-2.5 text-sm font-medium transition-colors",
            activeTab === tab.id
              ? "text-foreground after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
          {tab.count && tab.count > 0 ? (
            <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">
              {tab.count}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
