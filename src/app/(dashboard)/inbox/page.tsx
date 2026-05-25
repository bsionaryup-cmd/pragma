import { Suspense } from "react";
import { InboxPageView } from "@/components/inbox/inbox-page-view";
import { listInboxConversations } from "@/services/inbox/inbox.service";
import InboxLoading from "./loading";

type InboxPageProps = {
  searchParams: Promise<{ conversation?: string }>;
};

async function InboxPageContent({
  searchParams,
}: {
  searchParams: Promise<{ conversation?: string }>;
}) {
  const params = await searchParams;
  let conversations: Awaited<
    ReturnType<typeof listInboxConversations>
  >["conversations"] = [];
  let unreadCount = 0;
  let loadError: string | null = null;

  try {
    const result = await listInboxConversations();
    conversations = result.conversations;
    unreadCount = result.unreadCount;
  } catch (error) {
    loadError =
      error instanceof Error
        ? error.message
        : "No se pudieron cargar las conversaciones";
  }

  const initialSelectedId =
    params.conversation &&
    conversations.some((c) => c.id === params.conversation)
      ? params.conversation
      : null;

  return (
    <InboxPageView
      initialConversations={conversations}
      initialUnreadCount={unreadCount}
      initialSelectedId={initialSelectedId}
      loadError={loadError}
    />
  );
}

export default function InboxPage({ searchParams }: InboxPageProps) {
  return (
    <Suspense fallback={<InboxLoading />}>
      <InboxPageContent searchParams={searchParams} />
    </Suspense>
  );
}
