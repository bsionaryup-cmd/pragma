"use client";

import { InboxConversationList } from "@/components/inbox/inbox-conversation-list";
import { InboxEmptyState } from "@/components/inbox/inbox-empty-state";

export function InboxPageView() {
  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden bg-white dark:bg-background">
      <InboxConversationList
        conversations={[]}
        selectedId={null}
        unreadCount={0}
        onSelect={() => {}}
      />
      <InboxEmptyState />
    </div>
  );
}
