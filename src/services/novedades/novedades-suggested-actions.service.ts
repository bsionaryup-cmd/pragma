import type { QuickMessageType } from "@/lib/reservations/quick-messages";
import { QUICK_MESSAGE_TYPE_ORDER } from "@/lib/default-message-templates";
import {
  applyQuickMessageTemplate,
  buildQuickMessageDataFromReservation,
  quickMessageButtonLabel,
  type QuickMessageTemplates,
} from "@/lib/reservations/quick-message-templates";
import { buildQuickMessage } from "@/lib/reservations/quick-messages";
import type {
  NovedadesSuggestedAction,
  NovedadesTimelineEntry,
  NovedadesTimelineKind,
} from "@/services/novedades/novedades-inbox.types";
import { detectNovedadesStayStage, type NovedadesStayStage } from "@/services/novedades/novedades-stay-stage";
import type { ReservationStatus } from "@prisma/client";

export type GuestMessageIntent =
  | "EARLY_CHECKIN"
  | "LATE_CHECKOUT"
  | "WIFI"
  | "ACCESS"
  | "PARKING"
  | "GENERAL";

type BuildSuggestedActionsInput = {
  stage: NovedadesStayStage;
  status: ReservationStatus;
  checkIn: string;
  checkOut: string;
  guestRegistrationCompleted: boolean;
  hasRegistrationLink: boolean;
  entries: NovedadesTimelineEntry[];
  messageData: Parameters<typeof buildQuickMessageDataFromReservation>[0];
  templates: QuickMessageTemplates | null;
  accessCode: string | null;
  registrationLink: string | null;
};

const QUICK_LABELS: Record<QuickMessageType, string> = {
  WELCOME: quickMessageButtonLabel("WELCOME"),
  REGISTRATION: quickMessageButtonLabel("REGISTRATION"),
  ACCESS: quickMessageButtonLabel("ACCESS"),
  FOLLOW_UP: quickMessageButtonLabel("FOLLOW_UP"),
  HOUSE_RULES: quickMessageButtonLabel("HOUSE_RULES"),
  CHECKOUT: quickMessageButtonLabel("CHECKOUT"),
  REVIEW: quickMessageButtonLabel("REVIEW"),
};

function makeQuickAction(
  type: QuickMessageType,
  input: BuildSuggestedActionsInput,
  variant: NovedadesSuggestedAction["variant"],
  hint?: string,
): NovedadesSuggestedAction {
  const data = buildQuickMessageDataFromReservation({
    ...input.messageData,
    registrationLink: input.registrationLink,
    accessCode: input.accessCode,
  });

  return {
    id: `quick:${type}`,
    label: QUICK_LABELS[type],
    messageText: buildQuickMessage(type, data, input.templates),
    variant,
    hint,
  };
}

function makeCustomAction(
  id: string,
  label: string,
  template: string,
  data: ReturnType<typeof buildQuickMessageDataFromReservation>,
  variant: NovedadesSuggestedAction["variant"],
  hint?: string,
): NovedadesSuggestedAction {
  return {
    id,
    label,
    messageText: applyQuickMessageTemplate(template, data),
    variant,
    hint,
  };
}

function hasRecentEntry(
  entries: NovedadesTimelineEntry[],
  kinds: NovedadesTimelineKind[],
  withinHours = 72,
): boolean {
  const cutoff = Date.now() - withinHours * 60 * 60 * 1000;
  return entries.some(
    (entry) =>
      kinds.includes(entry.kind) && new Date(entry.createdAt).getTime() >= cutoff,
  );
}

export function detectGuestMessageIntent(body: string | null | undefined): GuestMessageIntent {
  const text = body?.toLowerCase() ?? "";
  if (!text.trim()) return "GENERAL";
  if (/check[- ]?in|llegar|llegada|entrada|antes de las|early/i.test(text)) {
    return "EARLY_CHECKIN";
  }
  if (/check[- ]?out|salir|salida|late checkout|salida tard/i.test(text)) {
    return "LATE_CHECKOUT";
  }
  if (/wifi|wi-fi|internet|clave|password|contraseña/i.test(text)) {
    return "WIFI";
  }
  if (/código|codigo|acceso|llave|puerta|key|lock|entrar/i.test(text)) {
    return "ACCESS";
  }
  if (/parqueadero|parking|estacionamiento|carro|auto/i.test(text)) {
    return "PARKING";
  }
  return "GENERAL";
}

export function buildGuestMessageReplyActions(input: {
  messageBody: string;
  messageData: Parameters<typeof buildQuickMessageDataFromReservation>[0];
  templates: QuickMessageTemplates | null;
  registrationLink: string | null;
  accessCode: string | null;
}): NovedadesSuggestedAction[] {
  const data = buildQuickMessageDataFromReservation({
    ...input.messageData,
    registrationLink: input.registrationLink,
    accessCode: input.accessCode,
  });
  const intent = detectGuestMessageIntent(input.messageBody);
  const actions: NovedadesSuggestedAction[] = [];

  const thanks = makeCustomAction(
    "reply:thanks",
    "💬 Agradecer",
    `Hola {guestName}, gracias por escribir. En un momento te confirmo los detalles.`,
    data,
    "secondary",
    "Respuesta corta mientras revisas",
  );

  switch (intent) {
    case "EARLY_CHECKIN":
      actions.push(
        makeCustomAction(
          "reply:early-checkin",
          "🕒 Confirmar llegada",
          `Hola {guestName}, sí podemos coordinar tu llegada. Te envío los datos de acceso:\n\n📍 {address}\n🕒 Check-in: {checkInTime}\n🔐 Acceso: {accessCode}\n\nWhatsApp: {receptionWhatsapp}`,
          data,
          "primary",
          "Respuesta a consulta de check-in",
        ),
        makeQuickAction(
          "ACCESS",
          {
            stage: "PRE_ARRIVAL",
            status: "CONFIRMED" as ReservationStatus,
            checkIn: input.messageData.checkIn,
            checkOut: input.messageData.checkOut,
            guestRegistrationCompleted: false,
            hasRegistrationLink: Boolean(input.registrationLink),
            entries: [],
            messageData: input.messageData,
            templates: input.templates,
            accessCode: input.accessCode,
            registrationLink: input.registrationLink,
          },
          "secondary",
        ),
      );
      break;
    case "WIFI":
      actions.push(
        makeQuickAction(
          "FOLLOW_UP",
          {
            stage: "IN_STAY",
            status: "CHECKED_IN" as ReservationStatus,
            checkIn: input.messageData.checkIn,
            checkOut: input.messageData.checkOut,
            guestRegistrationCompleted: true,
            hasRegistrationLink: false,
            entries: [],
            messageData: input.messageData,
            templates: input.templates,
            accessCode: input.accessCode,
            registrationLink: input.registrationLink,
          },
          "primary",
          "WiFi y datos de estadía",
        ),
      );
      break;
    case "ACCESS":
      actions.push(
        makeQuickAction(
          "ACCESS",
          {
            stage: "PRE_ARRIVAL",
            status: "CONFIRMED" as ReservationStatus,
            checkIn: input.messageData.checkIn,
            checkOut: input.messageData.checkOut,
            guestRegistrationCompleted: false,
            hasRegistrationLink: false,
            entries: [],
            messageData: input.messageData,
            templates: input.templates,
            accessCode: input.accessCode,
            registrationLink: input.registrationLink,
          },
          "primary",
        ),
      );
      break;
    case "LATE_CHECKOUT":
      actions.push(
        makeCustomAction(
          "reply:late-checkout",
          "🕚 Consultar salida",
          `Hola {guestName}, revisaré si podemos coordinar una salida tardía y te confirmo por aquí.`,
          data,
          "primary",
        ),
      );
      break;
    case "PARKING":
      actions.push(
        makeCustomAction(
          "reply:parking",
          "🅿️ Parqueadero",
          `Hola {guestName}, te confirmo enseguida las opciones de parqueadero para {propertyName}.`,
          data,
          "primary",
        ),
      );
      break;
    default:
      actions.push(thanks);
      break;
  }

  if (!actions.some((action) => action.id === thanks.id)) {
    actions.push(thanks);
  }

  return actions.slice(0, 3);
}

/** Los 7 mensajes oficiales listos para copiar (sin depender de la etapa). */
export function buildAllQuickMessageCopyActions(input: {
  messageData: Parameters<typeof buildQuickMessageDataFromReservation>[0];
  templates: QuickMessageTemplates | null;
  registrationLink: string | null;
  accessCode: string | null;
  highlightTypes?: QuickMessageType[];
}): NovedadesSuggestedAction[] {
  const data = buildQuickMessageDataFromReservation({
    ...input.messageData,
    registrationLink: input.registrationLink,
    accessCode: input.accessCode,
  });
  const highlight = new Set(input.highlightTypes ?? []);

  return QUICK_MESSAGE_TYPE_ORDER.map((type) => {
    const messageText = buildQuickMessage(type, data, input.templates);
    return {
      id: `quick:${type}`,
      label: QUICK_LABELS[type],
      messageText,
      variant: highlight.has(type) ? ("primary" as const) : ("secondary" as const),
      hint: "Copia y pega en Airbnb o WhatsApp",
    };
  }).filter((action) => action.messageText.trim().length > 0);
}

export function buildNovedadesSuggestedActions(
  input: BuildSuggestedActionsInput,
): NovedadesSuggestedAction[] {
  if (input.stage === "CANCELLED") return [];

  const actions: NovedadesSuggestedAction[] = [];
  const newBooking =
    input.stage === "NEW_BOOKING" ||
    hasRecentEntry(input.entries, ["NEW_RESERVATION", "RESERVATION_CREATED"]);

  if (newBooking) {
    actions.push(
      makeQuickAction(
        "WELCOME",
        input,
        "primary",
        "Copia y pega en el chat de Airbnb",
      ),
    );
  }

  if (input.hasRegistrationLink && !input.guestRegistrationCompleted) {
    actions.push(
      makeQuickAction(
        "REGISTRATION",
        input,
        newBooking ? "secondary" : "primary",
        "Enviar enlace de registro",
      ),
    );
  }

  if (
    input.stage === "PRE_ARRIVAL" ||
    input.stage === "CHECK_IN_DAY" ||
    hasRecentEntry(input.entries, ["ALERT"], 48)
  ) {
    actions.push(
      makeQuickAction(
        "ACCESS",
        input,
        input.stage === "CHECK_IN_DAY" ? "primary" : "secondary",
        "Instrucciones de llegada",
      ),
    );
  }

  if (input.stage === "IN_STAY") {
    actions.push(
      makeQuickAction(
        "FOLLOW_UP",
        input,
        "secondary",
        "WiFi y apoyo durante la estadía",
      ),
      makeQuickAction(
        "HOUSE_RULES",
        input,
        "secondary",
        "Recordatorios de convivencia",
      ),
    );
  }

  if (input.stage === "CHECKOUT_DAY") {
    actions.push(
      makeQuickAction(
        "CHECKOUT",
        input,
        "primary",
        "Recordatorio de salida",
      ),
    );
  }

  if (input.stage === "POST_STAY") {
    actions.push(
      makeQuickAction(
        "REVIEW",
        input,
        "primary",
        "Pedir reseña en Airbnb",
      ),
    );
  }

  const deduped: NovedadesSuggestedAction[] = [];
  const seen = new Set<string>();
  for (const action of actions) {
    if (seen.has(action.id)) continue;
    seen.add(action.id);
    if (!action.messageText.trim()) continue;
    deduped.push(action);
  }

  return deduped.slice(0, 4);
}

export function resolveNovedadesStayStage(input: {
  status: ReservationStatus;
  checkIn: string;
  checkOut: string;
  now?: Date;
}): NovedadesStayStage {
  return detectNovedadesStayStage(input);
}
