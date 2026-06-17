"use client";

import { useEffect } from "react";
import { NovedadesInbox } from "@/features/novedades/components/novedades-inbox";
import { useNovedadesUnread } from "@/features/novedades/components/novedades-unread-provider";
import type { NovedadesInboxListItem } from "@/services/novedades/novedades-inbox.types";

type NovedadesPageViewProps = {
  items: NovedadesInboxListItem[];
  scopeKey: string;
  latestAt: string | null;
  initialSelectedId?: string | null;
};

export function NovedadesPageView({
  items,
  scopeKey,
  latestAt,
  initialSelectedId = null,
}: NovedadesPageViewProps) {
  const { markSeen } = useNovedadesUnread();

  useEffect(() => {
    markSeen(latestAt ?? items[0]?.latestAt ?? null, scopeKey);
  }, [items, latestAt, markSeen, scopeKey]);

  return (
    <NovedadesInbox
      items={items}
      initialSelectedId={initialSelectedId}
    />
  );
}
