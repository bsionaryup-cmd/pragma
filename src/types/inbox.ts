export type InboxConversationStatus = "open" | "reserved";

export type InboxMessage = {
  id: string;
  sender: "guest" | "host";
  senderName: string;
  senderInitial: string;
  time: string;
  body: string;
};

export type InboxConversation = {
  id: string;
  guestName: string;
  guestInitial: string;
  preview: string;
  time: string;
  dateRange: string;
  status: InboxConversationStatus;
  statusLabel: string;
  propertyImageUrl: string | null;
  bookingCode: string;
  platform: "AIRBNB";
  propertyName: string;
  propertyUnit: string;
  propertyId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  nights: number;
  dueAmount: number;
  paidAmount: number;
  totalAmount: number;
  currency: string;
  lastMessageAt: string;
  guestEmail: string;
  guestPhone: string;
  guestLanguage: string;
  estimatedArrival: string;
  estimatedDeparture: string;
  notes: string;
  dateSeparator: string;
  messages: InboxMessage[];
};
