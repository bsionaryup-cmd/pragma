export type ConciergeChannel =
  | "airbnb_web"
  | "whatsapp_web"
  | "booking"
  | "messenger"
  | "instagram"
  | "email"
  | "internal";

export type ConciergeMessageRole = "guest" | "host" | "system" | "agent";

export type ConciergeMessage = {
  id: string;
  conversationId: string;
  role: ConciergeMessageRole;
  body: string;
  channel: ConciergeChannel;
  /** Idempotency / provider id when available. */
  externalMessageId?: string | null;
  createdAt: string;
};

export type ConciergeConversation = {
  id: string;
  organizationId: string;
  propertyId?: string | null;
  reservationId?: string | null;
  channel: ConciergeChannel;
  guestLabel?: string | null;
  messages: ConciergeMessage[];
  createdAt: string;
  updatedAt: string;
};
