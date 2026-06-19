import { DEFAULT_MESSAGE_TEMPLATES } from "@/lib/default-message-templates";
import type { QuickMessageType } from "@/lib/default-message-templates";
import type { QuickMessageTemplates } from "@/lib/reservations/quick-message-templates";
import { hasCustomQuickMessageTemplates } from "@/lib/reservations/quick-message-templates";
import type { QuickMessageData } from "@/lib/reservations/quick-messages";
import { buildQuickMessage } from "@/lib/reservations/quick-messages";
import type { InboxAiIntent } from "@/services/inbox-ai/inbox-intent.types";
import type { OperationalFeedCard } from "@/services/novedades/operational-feed.types";
import {
  resolveGuestMessageBodiesForDisplay,
  resolveGuestMessageParseName,
} from "@/services/novedades/operational-feed.message";
import type {
  InboxAiAccessContext,
  InboxAiGuestMessageSummary,
  InboxAiHistoryEntry,
  InboxAiPropertyContext,
  InboxAiReservationContext,
  InboxAiTaskSummary,
  InboxAiTemplateSource,
} from "@/services/inbox-ai/inbox-context.types";

const FACT_KEYS = {
  guestName: "guestName",
  propertyName: "propertyName",
  propertyAddress: "propertyAddress",
  checkIn: "checkIn",
  checkOut: "checkOut",
  stayRange: "stayRange",
  checkInTime: "checkInTime",
  checkOutTime: "checkOutTime",
  wifiName: "wifiName",
  wifiPassword: "wifiPassword",
  houseRules: "houseRules",
  accessCode: "accessCode",
  accessInstructions: "accessInstructions",
  registrationLink: "registrationLink",
  receptionWhatsapp: "receptionWhatsapp",
  reservationCode: "reservationCode",
  reservationStatus: "reservationStatus",
  totalAmount: "totalAmount",
  neighborhood: "neighborhood",
  city: "city",
} as const;

type FactKey = (typeof FACT_KEYS)[keyof typeof FACT_KEYS];

const OPTIONAL_FACT_CHECKS: Array<{
  key: FactKey;
  label: string;
  read: (input: {
    reservation: InboxAiReservationContext;
    property: InboxAiPropertyContext;
    access: InboxAiAccessContext;
  }) => string | null | undefined;
}> = [
  { key: "wifiName", label: "Nombre de red WiFi", read: (i) => i.property.wifiName },
  { key: "wifiPassword", label: "Contraseña WiFi", read: (i) => i.property.wifiPassword },
  { key: "houseRules", label: "Reglas de la casa", read: (i) => i.property.houseRules },
  {
    key: "accessCode",
    label: "Código de acceso",
    read: (i) => i.access.manualAccessCode ?? i.property.accessCode,
  },
  {
    key: "accessInstructions",
    label: "Instrucciones de acceso",
    read: (i) => i.property.accessInstructions,
  },
  {
    key: "registrationLink",
    label: "Enlace de registro de huéspedes",
    read: (i) => i.reservation.registrationLink,
  },
  {
    key: "receptionWhatsapp",
    label: "WhatsApp de recepción",
    read: (i) => i.property.receptionWhatsapp,
  },
  { key: "checkInTime", label: "Hora de check-in", read: (i) => i.property.checkInTime },
  { key: "checkOutTime", label: "Hora de check-out", read: (i) => i.property.checkOutTime },
];

function pushFact(
  target: Record<string, string>,
  key: string,
  value: string | null | undefined,
): void {
  const trimmed = value?.trim();
  if (!trimmed) return;
  target[key] = trimmed;
}

export function resolveInboxAiTemplates(
  propertyTemplates: QuickMessageTemplates,
): { source: InboxAiTemplateSource; templates: QuickMessageTemplates } {
  if (hasCustomQuickMessageTemplates(propertyTemplates)) {
    return {
      source: "property",
      templates: { ...DEFAULT_MESSAGE_TEMPLATES, ...propertyTemplates },
    };
  }
  return { source: "defaults", templates: { ...DEFAULT_MESSAGE_TEMPLATES } };
}

export function extractGuestMessagesFromFeedCards(
  cards: OperationalFeedCard[],
): InboxAiGuestMessageSummary[] {
  const messages: InboxAiGuestMessageSummary[] = [];

  for (const card of cards) {
    if (card.kind !== "GUEST_MESSAGE") continue;

    const parseGuestName = resolveGuestMessageParseName({
      raw: card.summary,
      guestName: card.guestName,
    });
    const bodies = resolveGuestMessageBodiesForDisplay(card.summary, {
      guestName: parseGuestName,
    });

    if (bodies.length === 0) continue;

    for (let index = 0; index < bodies.length; index += 1) {
      messages.push({
        id: bodies.length > 1 ? `${card.id}:msg:${index}` : card.id,
        body: bodies[index]!,
        createdAt: card.createdAt,
        senderName: card.guestName,
      });
    }
  }

  return messages.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function extractActivityHistoryFromFeedCards(
  cards: OperationalFeedCard[],
): InboxAiHistoryEntry[] {
  return cards
    .filter((card) => card.kind !== "GUEST_MESSAGE")
    .map((card) => ({
      id: card.id,
      kind: card.kind,
      narrative: card.narrative,
      createdAt: card.createdAt,
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function buildKnownFacts(input: {
  reservation: InboxAiReservationContext;
  property: InboxAiPropertyContext;
  access: InboxAiAccessContext;
  tasks: InboxAiTaskSummary[];
  guestMessages: InboxAiGuestMessageSummary[];
}): Record<string, string> {
  const facts: Record<string, string> = {};

  pushFact(facts, FACT_KEYS.guestName, input.reservation.guestName);
  pushFact(facts, FACT_KEYS.propertyName, input.property.label);
  pushFact(facts, FACT_KEYS.propertyAddress, input.property.address);
  pushFact(facts, FACT_KEYS.checkIn, input.reservation.checkIn);
  pushFact(facts, FACT_KEYS.checkOut, input.reservation.checkOut);
  pushFact(facts, FACT_KEYS.stayRange, input.reservation.stayRange);
  pushFact(facts, FACT_KEYS.checkInTime, input.property.checkInTime);
  pushFact(facts, FACT_KEYS.checkOutTime, input.property.checkOutTime);
  pushFact(facts, FACT_KEYS.wifiName, input.property.wifiName);
  pushFact(facts, FACT_KEYS.wifiPassword, input.property.wifiPassword);
  pushFact(facts, FACT_KEYS.houseRules, input.property.houseRules);
  pushFact(
    facts,
    FACT_KEYS.accessCode,
    input.access.manualAccessCode ?? input.property.accessCode,
  );
  pushFact(facts, FACT_KEYS.accessInstructions, input.property.accessInstructions);
  pushFact(facts, FACT_KEYS.registrationLink, input.reservation.registrationLink);
  pushFact(facts, FACT_KEYS.receptionWhatsapp, input.property.receptionWhatsapp);
  pushFact(facts, FACT_KEYS.neighborhood, input.property.neighborhood);
  pushFact(facts, FACT_KEYS.city, input.property.city);
  pushFact(facts, FACT_KEYS.reservationCode, input.reservation.reservationCode);
  pushFact(facts, FACT_KEYS.reservationStatus, input.reservation.statusLabel);
  pushFact(facts, FACT_KEYS.totalAmount, input.reservation.totalAmountLabel);

  if (input.reservation.guestRegistrationCompleted) {
    facts.guestRegistrationCompleted = "true";
  }

  const pendingTasks = input.tasks.filter((task) => task.status === "PENDING");
  if (pendingTasks.length > 0) {
    facts.pendingTasks = pendingTasks.map((task) => task.title).join("; ");
  }

  if (input.access.credentials.length > 0) {
    facts.ttlockCredentials = input.access.credentials
      .map((row) => `${row.status} (${row.deliveryStatus})`)
      .join("; ");
  }

  const lastGuestMessage = input.guestMessages[input.guestMessages.length - 1];
  if (lastGuestMessage) {
    facts.lastGuestMessage = lastGuestMessage.body;
  }

  return facts;
}

export function detectMissingFacts(input: {
  reservation: InboxAiReservationContext;
  property: InboxAiPropertyContext;
  access: InboxAiAccessContext;
}): string[] {
  const missing: string[] = [];

  for (const check of OPTIONAL_FACT_CHECKS) {
    const value = check.read(input);
    if (!value?.trim()) {
      missing.push(check.label);
    }
  }

  if (
    !input.reservation.guestRegistrationCompleted &&
    !input.reservation.registrationLink?.trim()
  ) {
    missing.push("Registro de huéspedes completado o enlace disponible");
  }

  return missing;
}

const FACT_LABELS: Record<string, string> = {
  guestName: "Huésped",
  propertyName: "Propiedad",
  propertyAddress: "Dirección",
  neighborhood: "Barrio",
  city: "Ciudad",
  checkIn: "Check-in (fecha)",
  checkOut: "Check-out (fecha)",
  stayRange: "Estadía",
  checkInTime: "Hora check-in",
  checkOutTime: "Hora check-out",
  wifiName: "Red WiFi",
  wifiPassword: "Clave WiFi",
  houseRules: "Reglas de la casa",
  accessCode: "Código de acceso",
  accessInstructions: "Instrucciones de acceso",
  registrationLink: "Enlace registro huéspedes",
  receptionWhatsapp: "WhatsApp recepción",
  reservationCode: "Código reserva",
  reservationStatus: "Estado reserva",
  totalAmount: "Total reserva",
  lastGuestMessage: "Último mensaje huésped",
};

export function selectQuickMessageTypesForIntent(
  intent: InboxAiIntent,
): QuickMessageType[] {
  switch (intent) {
    case "WIFI":
      return ["FOLLOW_UP", "ACCESS"];
    case "ACCESS":
    case "CHECK_IN":
    case "EARLY_CHECKIN":
    case "LOCATION":
      return ["ACCESS", "WELCOME"];
    case "HOUSE_RULES":
      return ["HOUSE_RULES", "ACCESS"];
    case "CHECK_OUT":
    case "LATE_CHECKOUT":
      return ["CHECKOUT"];
    case "PARKING":
      return ["ACCESS", "WELCOME"];
    default:
      return ["WELCOME", "ACCESS"];
  }
}

export function formatQuickMessagesForPrompt(input: {
  intent: InboxAiIntent;
  messageData: QuickMessageData;
  templates: QuickMessageTemplates;
}): string {
  const types = selectQuickMessageTypesForIntent(input.intent);
  const lines: string[] = [
    "Plantillas operativas del anfitrión (información autorizada para usar en la respuesta):",
  ];

  for (const type of types) {
    const rendered = buildQuickMessage(type, input.messageData, input.templates).trim();
    if (!rendered) continue;
    lines.push(`--- ${type} ---`, rendered, "");
  }

  return lines.length > 1 ? lines.join("\n").trim() : "";
}

/** Serialización legible para prompts de IA. */
export function formatInboxAiContextForPrompt(input: {
  knownFacts: Record<string, string>;
  missingFacts: string[];
  guestMessages: InboxAiGuestMessageSummary[];
  activityHistory: InboxAiHistoryEntry[];
  stayStage: string;
  omitGuestMessages?: boolean;
}): string {
  const lines: string[] = [
    `Etapa de estadía: ${input.stayStage}`,
    "",
    "Hechos confirmados (solo usar esta información):",
  ];

  for (const [key, value] of Object.entries(input.knownFacts)) {
    if (key === "lastGuestMessage" && input.omitGuestMessages) continue;
    const label = FACT_LABELS[key] ?? key;
    lines.push(`- ${label}: ${value}`);
  }

  if (input.missingFacts.length > 0) {
    lines.push("", "Información NO disponible (no inventar):");
    for (const item of input.missingFacts) {
      lines.push(`- ${item}`);
    }
  }

  if (!input.omitGuestMessages && input.guestMessages.length > 0) {
    lines.push("", "Mensajes del huésped:");
    for (const message of input.guestMessages) {
      lines.push(`- [${message.createdAt}] ${message.body}`);
    }
  }

  if (input.activityHistory.length > 0) {
    lines.push("", "Historial reciente de la reserva:");
    for (const entry of input.activityHistory.slice(-12)) {
      lines.push(`- [${entry.createdAt}] ${entry.kind}: ${entry.narrative}`);
    }
  }

  return lines.join("\n");
}

export type InboxAiConversationSlice = {
  /** Mensajes anteriores al objetivo (contexto). */
  priorMessages: InboxAiGuestMessageSummary[];
  /** Mensaje al que se debe responder. */
  targetMessage: InboxAiGuestMessageSummary;
  /** Hilo completo hasta el objetivo (inclusive). */
  threadMessages: InboxAiGuestMessageSummary[];
};

/**
 * Recorta el hilo de chat hasta el mensaje objetivo (por id o cuerpo).
 * Evita incluir mensajes futuros cuando el host responde a uno intermedio.
 */
export function sliceGuestMessagesForReply(
  messages: InboxAiGuestMessageSummary[],
  target: { id?: string | null; body: string },
): InboxAiConversationSlice | null {
  if (messages.length === 0) return null;

  const normalizedBody = target.body.trim();
  let targetIndex = -1;

  if (target.id) {
    targetIndex = messages.findIndex((message) => message.id === target.id);
  }

  if (targetIndex < 0 && normalizedBody) {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index]?.body.trim() === normalizedBody) {
        targetIndex = index;
        break;
      }
    }
  }

  if (targetIndex < 0) {
    targetIndex = messages.length - 1;
  }

  const targetMessage = messages[targetIndex];
  if (!targetMessage) return null;

  return {
    priorMessages: messages.slice(0, targetIndex),
    targetMessage,
    threadMessages: messages.slice(0, targetIndex + 1),
  };
}

export function formatConversationThreadForPrompt(
  slice: InboxAiConversationSlice,
): string {
  const lines: string[] = [
    "Hilo de conversación con el huésped (cronológico):",
  ];

  for (let index = 0; index < slice.threadMessages.length; index += 1) {
    const message = slice.threadMessages[index]!;
    const isTarget = message.id === slice.targetMessage.id;
    const marker = isTarget ? " ← RESPONDER A ESTE MENSAJE" : "";
    lines.push(`${index + 1}. Huésped: "${message.body}"${marker}`);
  }

  if (slice.priorMessages.length > 0) {
    lines.push(
      "",
      "Ten en cuenta el contexto previo: el huésped puede estar continuando un tema anterior.",
    );
  }

  return lines.join("\n");
}

export function formatKnowledgeForPrompt(
  sections: Array<{ title: string; body: string }>,
): string {
  if (sections.length === 0) return "";

  const lines = ["Base de conocimiento de la propiedad:"];
  for (const section of sections) {
    lines.push(`- ${section.title}: ${section.body}`);
  }
  return lines.join("\n");
}
