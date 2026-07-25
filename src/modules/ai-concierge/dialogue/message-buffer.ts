/**
 * Short coalescing window for rapid guest bursts (same thread).
 * Additive — does not replace channel queue lock or idempotency claims.
 */
export type ConciergeBufferResult = {
  coalesced: string;
  parts: string[];
  wasBuffered: boolean;
  /** Earlier HTTP waiters in the same window must not compose/send. */
  suppressed: boolean;
};

type BufferEntry = {
  parts: string[];
  externalIds: Array<string | null>;
  waiters: Array<(result: ConciergeBufferResult) => void>;
  timer: ReturnType<typeof setTimeout> | null;
};

const buffers = new Map<string, BufferEntry>();

/** Default ~2.2s — human typing buffer without feeling stuck. */
export const CONCIERGE_MESSAGE_BUFFER_MS = 2_200;

export function conciergeBufferKey(input: {
  organizationId: string;
  channel: string;
  threadId: string;
}): string {
  return `${input.organizationId}:${input.channel}:${input.threadId}`;
}

/**
 * Collect consecutive guest messages for the same thread.
 * Only the last waiter receives the coalesced text; others are suppressed.
 */
export function enqueueConciergeMessageBuffer(input: {
  key: string;
  message: string;
  externalMessageId?: string | null;
  windowMs?: number;
}): Promise<ConciergeBufferResult> {
  const windowMs = input.windowMs ?? CONCIERGE_MESSAGE_BUFFER_MS;
  const text = input.message.trim();
  if (!text) {
    return Promise.resolve({
      coalesced: "",
      parts: [],
      wasBuffered: false,
      suppressed: true,
    });
  }

  return new Promise((resolve) => {
    // Long messages are usually complete turns — don't add buffer latency.
    if (text.length >= 120) {
      resolve({
        coalesced: text,
        parts: [text],
        wasBuffered: false,
        suppressed: false,
      });
      return;
    }

    let entry = buffers.get(input.key);
    if (!entry) {
      entry = { parts: [], externalIds: [], waiters: [], timer: null };
      buffers.set(input.key, entry);
    }
    entry.parts.push(text);
    entry.externalIds.push(input.externalMessageId?.trim() || null);
    entry.waiters.push(resolve);

    if (entry.timer) clearTimeout(entry.timer);
    entry.timer = setTimeout(() => {
      const current = buffers.get(input.key);
      if (!current) return;
      buffers.delete(input.key);
      const parts = [...current.parts];
      const coalesced = parts.join("\n").trim();
      const waiters = [...current.waiters];
      const wasBuffered = parts.length > 1;
      waiters.forEach((waiter, index) => {
        const isLast = index === waiters.length - 1;
        waiter({
          coalesced: isLast ? coalesced : "",
          parts: isLast ? parts : [],
          wasBuffered,
          suppressed: !isLast,
        });
      });
    }, windowMs);
  });
}

/** Test helper — clears in-flight buffers. */
export function resetConciergeMessageBuffersForTests(): void {
  for (const entry of buffers.values()) {
    if (entry.timer) clearTimeout(entry.timer);
  }
  buffers.clear();
}
