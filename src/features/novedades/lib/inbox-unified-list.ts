import type {
  NovedadesInboxListItem,
  NovedadesUnlinkedInquiryItem,
} from "@/services/novedades/novedades-inbox.types";

export type InboxUnifiedThread =
  | {
      kind: "reservation";
      threadId: string;
      latestAt: string;
      attentionCount: number;
      item: NovedadesInboxListItem;
    }
  | {
      kind: "inquiry";
      threadId: string;
      latestAt: string;
      attentionCount: number;
      item: NovedadesUnlinkedInquiryItem;
    };

export function buildUnifiedInboxThreads(input: {
  items: NovedadesInboxListItem[];
  unlinkedInquiries: NovedadesUnlinkedInquiryItem[];
}): InboxUnifiedThread[] {
  const reservationThreads: InboxUnifiedThread[] = input.items.map((item) => ({
    kind: "reservation",
    threadId: item.reservationId,
    latestAt: item.latestAt,
    attentionCount: item.attentionCount,
    item,
  }));

  const inquiryThreads: InboxUnifiedThread[] = input.unlinkedInquiries.map((item) => ({
    kind: "inquiry",
    threadId: item.pendingActivityId,
    latestAt: item.latestAt,
    attentionCount: 0,
    item,
  }));

  return [...reservationThreads, ...inquiryThreads].sort((a, b) =>
    b.latestAt.localeCompare(a.latestAt),
  );
}

export function filterUnifiedInboxThreads(
  threads: InboxUnifiedThread[],
  input: {
    query: string;
    pendingOnly: boolean;
  },
): InboxUnifiedThread[] {
  let list = threads;

  if (input.pendingOnly) {
    list = list.filter((thread) => thread.attentionCount > 0);
  }

  const q = input.query.trim().toLowerCase();
  if (!q) return list;

  return list.filter((thread) => {
    if (thread.kind === "reservation") {
      const item = thread.item;
      return (
        item.guestName.toLowerCase().includes(q) ||
        item.propertyLabel.toLowerCase().includes(q) ||
        item.latestNarrative.toLowerCase().includes(q) ||
        (item.confirmationCode?.toLowerCase().includes(q) ?? false)
      );
    }

    const item = thread.item;
    return (
      item.guestName.toLowerCase().includes(q) ||
      item.propertyLabel.toLowerCase().includes(q) ||
      item.latestNarrative.toLowerCase().includes(q) ||
      (item.subject?.toLowerCase().includes(q) ?? false)
    );
  });
}
