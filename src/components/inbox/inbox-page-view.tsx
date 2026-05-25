"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { InboxChatPanel } from "@/components/inbox/inbox-chat-panel";
import { InboxConversationList } from "@/components/inbox/inbox-conversation-list";
import { InboxEmptyState } from "@/components/inbox/inbox-empty-state";
import { InboxReservationSidebar } from "@/components/inbox/inbox-reservation-sidebar";
import {
  getInboxConversationAction,
  listInboxConversationsAction,
} from "@/features/inbox/actions/inbox.actions";
import {
  subscribeDashboardDataRefresh,
} from "@/lib/dashboard-refresh";
import type { InboxConversation } from "@/types/inbox";

type InboxPageViewProps = {
  initialConversations: InboxConversation[];
  initialUnreadCount: number;
  initialSelectedId: string | null;
  loadError?: string | null;
};

export function InboxPageView({
  initialConversations,
  initialUnreadCount,
  initialSelectedId,
  loadError = null,
}: InboxPageViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [conversations, setConversations] =
    useState<InboxConversation[]>(initialConversations);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [listError, setListError] = useState<string | null>(loadError);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [activeConversation, setActiveConversation] =
    useState<InboxConversation | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const syncUrl = useCallback(
    (conversationId: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (conversationId) {
        params.set("conversation", conversationId);
      } else {
        params.delete("conversation");
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const refreshList = useCallback(() => {
    startTransition(async () => {
      const result = await listInboxConversationsAction();
      if (!result.success) {
        setListError(result.error);
        return;
      }
      setListError(null);
      setConversations(result.conversations);
      setUnreadCount(result.unreadCount);
    });
  }, []);

  const loadConversation = useCallback(async (id: string) => {
    setDetailLoading(true);
    setDetailError(null);
    const result = await getInboxConversationAction(id);
    setDetailLoading(false);

    if (!result.success) {
      setActiveConversation(null);
      setDetailError(result.error);
      toast.error(result.error);
      return;
    }

    setActiveConversation(result.conversation);
    setConversations((prev) =>
      prev.map((item) =>
        item.id === result.conversation.id
          ? {
              ...item,
              preview: result.conversation.preview,
              time: result.conversation.time,
              lastMessageAt: result.conversation.lastMessageAt,
            }
          : item,
      ),
    );
  }, []);

  useEffect(() => {
    return subscribeDashboardDataRefresh(() => {
      refreshList();
      if (selectedId) {
        void loadConversation(selectedId);
      }
    });
  }, [refreshList, selectedId, loadConversation]);

  useEffect(() => {
    const fromUrl = searchParams.get("conversation");
    if (fromUrl === selectedId) return;
    queueMicrotask(() => setSelectedId(fromUrl));
  }, [searchParams, selectedId]);

  useEffect(() => {
    if (!selectedId) {
      queueMicrotask(() => {
        setActiveConversation(null);
        setDetailError(null);
      });
      return;
    }

    queueMicrotask(() => {
      void loadConversation(selectedId);
    });
  }, [selectedId, loadConversation]);

  useEffect(() => {
    if (!selectedId || conversations.length === 0) return;
    const exists = conversations.some((c) => c.id === selectedId);
    if (!exists) {
      queueMicrotask(() => {
        setSelectedId(null);
        setActiveConversation(null);
        syncUrl(null);
      });
    }
  }, [selectedId, conversations, syncUrl]);

  function handleSelect(id: string) {
    setSelectedId(id);
    syncUrl(id);
  }

  const showEmptyInbox = conversations.length === 0 && !listError;
  const showSelectPrompt =
    !showEmptyInbox && !selectedId && !detailLoading && !activeConversation;

  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden bg-white dark:bg-background">
      <InboxConversationList
        conversations={conversations}
        selectedId={selectedId}
        unreadCount={unreadCount}
        onSelect={handleSelect}
      />

      {listError ? (
        <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-3 bg-card px-8 text-center">
          <p className="text-sm font-medium text-destructive">{listError}</p>
          <button
            type="button"
            className="text-sm font-medium text-pragma-electric hover:underline"
            disabled={pending}
            onClick={() => refreshList()}
          >
            Reintentar
          </button>
        </div>
      ) : showEmptyInbox ? (
        <InboxEmptyState mode="no-conversations" />
      ) : showSelectPrompt ? (
        <InboxEmptyState mode="select-conversation" />
      ) : detailLoading && !activeConversation ? (
        <div className="flex min-w-0 flex-1 items-center justify-center bg-card text-sm text-muted-foreground">
          Cargando conversación…
        </div>
      ) : detailError && !activeConversation ? (
        <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-3 bg-card px-8 text-center">
          <p className="text-sm font-medium text-destructive">{detailError}</p>
          {selectedId ? (
            <button
              type="button"
              className="text-sm font-medium text-pragma-electric hover:underline"
              onClick={() => void loadConversation(selectedId)}
            >
              Reintentar
            </button>
          ) : null}
        </div>
      ) : activeConversation ? (
        <>
          <InboxChatPanel conversation={activeConversation} />
          <InboxReservationSidebar conversation={activeConversation} />
        </>
      ) : (
        <InboxEmptyState mode="select-conversation" />
      )}
    </div>
  );
}
