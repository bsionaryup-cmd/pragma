/**
 * Per-channel conversation queue (FIFO + priority).
 * In-memory, org-scoped — never crosses tenants.
 */
import type {
  ConciergeQueuePriority,
  ConciergeQueuedTurn,
} from "@/modules/ai-concierge/runtime/types";

const PRIORITY_RANK: Record<ConciergeQueuePriority, number> = {
  emergency: 0,
  active_guest: 1,
  recent: 2,
  normal: 3,
};

type ChannelQueue = {
  items: ConciergeQueuedTurn[];
  processing: boolean;
};

const queues = new Map<string, ChannelQueue>();

function queueKey(organizationId: string, channel: string): string {
  return `${organizationId}::${channel}`;
}

export function inferQueuePriority(input: {
  guestMessage: string;
  isActiveThread?: boolean;
}): ConciergeQueuePriority {
  const text = input.guestMessage.toLowerCase();
  if (
    /urgente|emergenc|911|incendio|fuga|amenaza|accidente|ambulanc/i.test(text)
  ) {
    return "emergency";
  }
  if (input.isActiveThread) return "active_guest";
  return "recent";
}

export function enqueueConciergeTurn(
  turn: ConciergeQueuedTurn,
): { queued: boolean; depth: number } {
  const key = queueKey(turn.organizationId, turn.channel);
  let q = queues.get(key);
  if (!q) {
    q = { items: [], processing: false };
    queues.set(key, q);
  }

  // Anti-duplicate: same thread + external id or same message body pending
  const dup = q.items.some(
    (item) =>
      item.threadId === turn.threadId &&
      ((turn.externalMessageId &&
        item.externalMessageId === turn.externalMessageId) ||
        item.guestMessage === turn.guestMessage),
  );
  if (dup) return { queued: false, depth: q.items.length };

  q.items.push(turn);
  q.items.sort((a, b) => {
    const pr = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (pr !== 0) return pr;
    return a.enqueuedAt - b.enqueuedAt;
  });
  return { queued: true, depth: q.items.length };
}

export async function withChannelQueueLock<T>(input: {
  organizationId: string;
  channel: string;
  run: () => Promise<T>;
}): Promise<T> {
  const key = queueKey(input.organizationId, input.channel);
  let q = queues.get(key);
  if (!q) {
    q = { items: [], processing: false };
    queues.set(key, q);
  }

  while (q.processing) {
    await new Promise((r) => setTimeout(r, 25));
  }
  q.processing = true;
  try {
    return await input.run();
  } finally {
    q.processing = false;
  }
}

export function getChannelQueueDepth(
  organizationId: string,
  channel: string,
): number {
  return queues.get(queueKey(organizationId, channel))?.items.length ?? 0;
}

/** Test helper */
export function __resetConciergeQueuesForTests(): void {
  queues.clear();
}
