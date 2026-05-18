"use client";

import Image from "next/image";
import { ListFilter, Search } from "lucide-react";
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
    <section className="flex h-full w-[min(100%,380px)] shrink-0 flex-col border-r border-[#e8e8e8] bg-white">
      <header className="border-b border-[#e8e8e8] px-5 pb-4 pt-5">
        <h1 className="text-xl font-bold text-[#1a1a1a]">Bandeja de entrada</h1>
        <p className="mt-0.5 text-sm text-[#6b6b6b]">
          {unreadCount} conversaciones sin leer
        </p>
        <div className="mt-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a9a9a]" />
            <input
              type="search"
              placeholder="Buscar"
              className="h-10 w-full rounded-full border border-[#e0e0e0] bg-white pl-9 pr-3 text-sm text-[#1a1a1a] outline-none placeholder:text-[#9a9a9a] focus:border-[#c8c8c8]"
            />
          </div>
          <button
            type="button"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#e0e0e0] bg-white text-[#4a4a4a] hover:bg-[#fafafa]"
            aria-label="Filtrar"
          >
            <ListFilter className="h-4 w-4" />
          </button>
        </div>
      </header>

      <ul className="flex-1 overflow-y-auto">
        {conversations.map((conversation) => {
          const isSelected = conversation.id === selectedId;
          return (
            <li key={conversation.id}>
              <button
                type="button"
                onClick={() => onSelect(conversation.id)}
                className={cn(
                  "flex w-full gap-3 border-b border-[#f0f0f0] px-4 py-3 text-left transition-colors",
                  isSelected ? "bg-[#f3f3f3]" : "bg-white hover:bg-[#fafafa]",
                )}
              >
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-[#efefef]">
                  <Image
                    src={conversation.propertyImageUrl}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="48px"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-[#1a1a1a]">
                      {conversation.guestName}
                    </p>
                    <span className="shrink-0 text-xs text-[#6b6b6b]">
                      {conversation.time}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-sm text-[#6b6b6b]">
                    {conversation.preview}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <PlatformBadge platform="AIRBNB" className="h-5 min-w-5 px-1" />
                    <span className="text-xs text-[#6b6b6b]">
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
