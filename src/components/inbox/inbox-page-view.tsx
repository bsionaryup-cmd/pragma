"use client";

import { useMemo, useState } from "react";
import { InboxChatPanel } from "@/components/inbox/inbox-chat-panel";
import { InboxConversationList } from "@/components/inbox/inbox-conversation-list";
import { InboxEmptyState } from "@/components/inbox/inbox-empty-state";
import { InboxReservationSidebar } from "@/components/inbox/inbox-reservation-sidebar";
import {
  INBOX_UNREAD_COUNT,
  MOCK_INBOX_CONVERSATIONS,
} from "@/lib/inbox/mock-data";

export function InboxPageView() {
  const [selectedId, setSelectedId] = useState<string | null>("conv-carlos");

  const selectedConversation = useMemo(
    () => MOCK_INBOX_CONVERSATIONS.find((c) => c.id === selectedId) ?? null,
    [selectedId],
  );

  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden bg-white">
      <InboxConversationList
        conversations={MOCK_INBOX_CONVERSATIONS}
        selectedId={selectedId}
        unreadCount={INBOX_UNREAD_COUNT}
        onSelect={setSelectedId}
      />

      {selectedConversation ? (
        <>
          <InboxChatPanel conversation={selectedConversation} />
          <InboxReservationSidebar conversation={selectedConversation} />
        </>
      ) : (
        <InboxEmptyState />
      )}
    </div>
  );
}
