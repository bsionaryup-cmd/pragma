import type { QuickMessageData } from "@/lib/reservations/quick-messages";
import type { QuickMessageTemplates } from "@/lib/reservations/quick-message-templates";
import type { NovedadesStayStageLabel } from "@/services/novedades/novedades-inbox.types";
import type { PropertyKnowledgeSnapshot } from "@/services/inbox-ai/inbox-knowledge.types";
import type { InboxAiIntent } from "@/services/inbox-ai/inbox-intent.types";
import type {
  BookingPlatform,
  PaymentStatus,
  ReservationStatus,
} from "@prisma/client";

/** Versión del contrato de contexto (para auditoría / prompts futuros). */
export const INBOX_AI_CONTEXT_VERSION = 1 as const;

export type InboxAiReservationContext = {
  id: string;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string | null;
  platform: BookingPlatform;
  status: ReservationStatus;
  statusLabel: string;
  reservationCode: string | null;
  checkIn: string;
  checkOut: string;
  stayRange: string;
  adults: number;
  children: number;
  infants: number;
  totalAmountLabel: string | null;
  paymentStatus: PaymentStatus;
  guestRegistrationCompleted: boolean;
  guestRegistrationCompletedAt: string | null;
  registrationLink: string | null;
};

export type InboxAiPropertyContext = {
  id: string;
  label: string;
  unitNumber: string | null;
  address: string;
  neighborhood: string | null;
  city: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  wifiName: string | null;
  wifiPassword: string | null;
  houseRules: string | null;
  accessCode: string | null;
  accessInstructions: string | null;
  receptionWhatsapp: string | null;
};

export type InboxAiAccessCredentialSummary = {
  id: string;
  status: string;
  deliveryStatus: string;
  validFrom: string | null;
  validTo: string | null;
};

export type InboxAiAccessContext = {
  manualAccessCode: string | null;
  credentials: InboxAiAccessCredentialSummary[];
};

export type InboxAiTaskSummary = {
  id: string;
  title: string;
  type: string;
  status: string;
  dueDate: string | null;
};

export type InboxAiGuestMessageSummary = {
  id: string;
  body: string;
  createdAt: string;
  senderName: string | null;
};

export type InboxAiHistoryEntry = {
  id: string;
  kind: string;
  narrative: string;
  createdAt: string;
};

export type InboxAiTemplateSource = "property" | "defaults";

export type InboxAiContext = {
  version: typeof INBOX_AI_CONTEXT_VERSION;
  reservationId: string;
  builtAt: string;
  stayStage: NovedadesStayStageLabel;
  reservation: InboxAiReservationContext;
  property: InboxAiPropertyContext;
  access: InboxAiAccessContext;
  tasks: InboxAiTaskSummary[];
  guestMessages: InboxAiGuestMessageSummary[];
  activityHistory: InboxAiHistoryEntry[];
  /** Datos normalizados reutilizados por plantillas rápidas existentes. */
  messageData: QuickMessageData;
  templates: {
    source: InboxAiTemplateSource;
    templates: QuickMessageTemplates;
  };
  /**
   * Solo hechos con valor real (nunca inventar en IA).
   * Claves estables en español/inglés técnico para prompts.
   */
  knownFacts: Record<string, string>;
  /** Campos operativos ausentes que la IA no debe asumir. */
  missingFacts: string[];
  knowledge: PropertyKnowledgeSnapshot;
  latestGuestIntent: InboxAiIntent | null;
};
