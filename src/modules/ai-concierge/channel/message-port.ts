/**
 * Channel message port — logic lives in PRAGMA; connectors only send/receive.
 * WhatsApp Web / Airbnb Web extensions implement this shape today.
 * WhatsApp Cloud API can implement the same port later without rewriting the engine.
 */
export type ConciergeInboundMessage = {
  channel: string;
  threadId: string;
  body: string;
  externalMessageId?: string | null;
  guestLabel?: string | null;
  propertyId?: string | null;
  reservationId?: string | null;
};

export type ConciergeOutboundMessage = {
  channel: string;
  threadId: string;
  body: string;
  mayAutoSend: boolean;
};

export type ConciergeMessagePort = {
  /** Receive normalized inbound messages into PRAGMA. */
  ingest(message: ConciergeInboundMessage): Promise<{ ok: boolean }>;
  /** Deliver a composed reply to the channel (extension or Cloud API). */
  deliver(message: ConciergeOutboundMessage): Promise<{ ok: boolean }>;
};

export const CONCIERGE_CHANNEL_PORTS = {
  whatsapp_web: "extension",
  airbnb_web: "extension",
  whatsapp_cloud: "cloud_api_future",
} as const;
