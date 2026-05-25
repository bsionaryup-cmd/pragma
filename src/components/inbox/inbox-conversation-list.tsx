"use client";

import { ListFilter, Search } from "lucide-react";
import { InboxAvatar } from "@/components/inbox/inbox-avatar";
import { InboxStatusBadge } from "@/components/inbox/inbox-status-badge";
import { PlatformBadge } from "@/components/dashboard/platform-badge";
import type { InboxConversation } from "@/types/inbox";
import { cn } from "@/lib/utils";

type InboxConversationListProps = {
  conversations: InboxConversation[];
  selectedId: string | null;
  unreadCount: number;
  onSelect: (id: string) => void;
};

export function InboxConversationList({
  conversations,
  selectedId,
  unreadCount,
  onSelect,
}: InboxConversationListProps) {
  return (
    <section className="flex h-full w-full min-w-0 shrink-0 flex-col border-r border-border bg-card md:w-[min(100%,380px)] md:max-w-[380px]">
      <header className="border-b border-border px-5 pb-4 pt-5">
        <h1 className="text-xl font-bold text-foreground">Bandeja de entrada</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {unreadCount} conversaciones sin leer
        </p>
        <div className="mt-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-subtle" />
            <input
              type="search"
              placeholder="Buscar"
              className="h-10 w-full rounded-full border border-border bg-card pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-text-subtle focus:border-ring"
            />
          </div>
          <button
            type="button"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:bg-accent"
            aria-label="Filtrar"
          >
            <ListFilter className="h-4 w-4" />
          </button>
        </div>
      </header>

      <ul className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <li className="px-5 py-8 text-center text-sm text-muted-foreground">
            Sin conversaciones todavía.
          </li>
        ) : null}
        {conversations.map((conversation) => {
          const isSelected = conversation.id === selectedId;
          return (
            <li key={conversation.id}>
              <button
                type="button"
                onClick={() => onSelect(conversation.id)}
                className={cn(
                  "flex w-full gap-3 border-b border-border px-4 py-3 text-left transition-colors",
                  isSelected ? "bg-accent" : "bg-card hover:bg-accent",
                )}
              >
                <InboxAvatar
                  imageUrl={conversation.propertyImageUrl}
                  name={conversation.guestName}
                  initials={conversation.guestInitial}
                  className="h-12 w-12"
                  sizes="48px"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {conversation.guestName}
                    </p>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {conversation.time}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                    {conversation.preview}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <PlatformBadge platform={conversation.platform} />
                    <span className="text-xs text-muted-foreground">
                      {conversation.dateRange}
                    </span>
                    <InboxStatusBadge
                      status={conversation.status}
                      label={conversation.statusLabel}
                    />
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
