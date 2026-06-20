"use client";

import { useEffect } from "react";
import { NovedadesInbox } from "@/features/novedades/components/novedades-inbox";
import { useNovedadesUnread } from "@/features/novedades/components/novedades-unread-provider";
import type { NovedadesInboxListItem, NovedadesUnlinkedInquiryItem } from "@/services/novedades/novedades-inbox.types";

type NovedadesPageViewProps = {
  items: NovedadesInboxListItem[];
  unlinkedInquiries: NovedadesUnlinkedInquiryItem[];
  scopeKey: string;
  latestAt: string | null;
  initialSelectedId?: string | null;
  initialSelectedInquiryId?: string | null;
};

export function NovedadesPageView({
  items,
  unlinkedInquiries,
  scopeKey,
  latestAt,
  initialSelectedId = null,
  initialSelectedInquiryId = null,
}: NovedadesPageViewProps) {
  const { markSeen } = useNovedadesUnread();

  useEffect(() => {
    markSeen(latestAt ?? items[0]?.latestAt ?? null, scopeKey);
  }, [items, latestAt, markSeen, scopeKey]);

  return (
    <NovedadesInbox
      items={items}
      unlinkedInquiries={unlinkedInquiries}
      initialSelectedId={initialSelectedId}
      initialSelectedInquiryId={initialSelectedInquiryId}
    />
  );
}
