/**
 * v2.1.1 Hierarchical workflow menu — additive on flow/pendingAction.
 * Menu complements NL (never replaces it). Context lock keeps the active protocol.
 *
 * Protocol: Usuario → opción/NL → (submenú) → workflow → consulta PMS → respuesta
 */
import type { ConciergeIntent } from "@/modules/ai-concierge/types/intent";
import type { ConciergeConversationFlowState } from "@/modules/ai-concierge/memory/fact-memory";
import { buildAvailabilitySlotsAsk } from "@/modules/ai-concierge/dialogue/stay-slot-ask";
import type { ResolvedAssistantPlaybook } from "@/modules/assistant-platform/types";
import { resolveMessage } from "@/modules/assistant-platform/resolve-playbook-messages";

export const WORKFLOW_MENU_STEP = "await_menu_choice";

/** After this idle gap, Context Lock expires — next Hola gets the main menu again. */
export const CONCIERGE_WORKFLOW_IDLE_MS = 8 * 60 * 1000;

export type MenuGroupId =
  | "bookings"
  | "my_reservation"
  | "stay"
  | "payments"
  | "human";

export type ConciergeWorkflowRoute = {
  /** submenu = show numbered submenu; leaf = enter concrete workflow */
  kind: "submenu" | "leaf" | "main_menu";
  menuGroup: MenuGroupId | null;
  workflowId: string;
  intent: ConciergeIntent;
  pendingAction: string | null;
  label: string;
};

/** Formal workflow card — validates protocol before answering. */
export type ConciergeWorkflowDefinition = {
  name: string;
  objective: string;
  required: string[];
  optional: string[];
  pmsQueries: string[];
  tools: string[];
  advanceWhen: string;
  finishWhen: string;
  escalateWhen: string;
};

export const WORKFLOW_DEFINITIONS: Record<string, ConciergeWorkflowDefinition> = {
  availability: {
    name: "Disponibilidad",
    objective: "Consultar cupo y precio en PRAGMA sin inventar",
    required: ["checkIn", "checkOut", "guests"],
    optional: ["propertyId"],
    pmsQueries: ["search_availability", "calculate_stay_quote"],
    tools: ["search_availability", "calculate_stay_quote"],
    advanceWhen: "Slot obligatorio capturado",
    finishWhen: "Disponibilidad/precio mostrados y pregunta de reserva respondida",
    escalateWhen: "Tool FAILED o propiedad ambigua",
  },
  quote: {
    name: "Cotización",
    objective: "Cotizar estancia con datos del PMS",
    required: ["checkIn", "checkOut", "guests"],
    optional: ["propertyId"],
    pmsQueries: ["calculate_stay_quote"],
    tools: ["calculate_stay_quote", "search_availability"],
    advanceWhen: "Fechas y huéspedes listos",
    finishWhen: "Cotización entregada",
    escalateWhen: "Sin tarifa en PMS",
  },
  booking_create: {
    name: "Crear reserva",
    objective: "Armar reserva solo tras confirmación y datos PMS",
    required: ["checkIn", "checkOut", "guests", "guestName", "confirm"],
    optional: ["propertyId"],
    pmsQueries: ["search_availability", "calculate_stay_quote"],
    tools: [
      "search_availability",
      "calculate_stay_quote",
      "reservation_adapter→create_direct_reservation",
    ],
    advanceWhen: "Confirmación explícita del huésped",
    finishWhen: "Adapter OK + reservationId real (nunca inventar 'creada')",
    escalateWhen: "Adapter FAILED o escritura pendiente de asesor",
  },
  wifi: {
    name: "WiFi",
    objective: "Entregar red/clave desde hechos PMS",
    required: ["propertyId|reservation"],
    optional: [],
    pmsQueries: ["get_property_wifi", "get_reservation_context"],
    tools: ["get_property_facts"],
    advanceWhen: "Propiedad o reserva identificada",
    finishWhen: "Credenciales entregadas",
    escalateWhen: "Sin WiFi en PMS",
  },
  ttlock: {
    name: "Ingreso TTLock",
    objective: "Código de acceso verificado en PMS",
    required: ["reservation|guest"],
    optional: [],
    pmsQueries: ["get_access_code"],
    tools: ["get_ttlock_access"],
    advanceWhen: "Reserva identificada",
    finishWhen: "Código entregado o handoff",
    escalateWhen: "Sin código / política bloquea",
  },
  checkin: {
    name: "Check-in / Check-out",
    objective: "Horarios y reglas de la propiedad",
    required: ["propertyId|reservation"],
    optional: [],
    pmsQueries: ["get_property_checkin_rules"],
    tools: ["get_property_facts"],
    advanceWhen: "Contexto de propiedad",
    finishWhen: "Horarios respondidos",
    escalateWhen: "Early/late requiere aprobación humana",
  },
  cancel: {
    name: "Cancelar reserva",
    objective: "Confirmar y escalar; nunca auto-cancelar",
    required: ["confirm"],
    optional: ["reservationId"],
    pmsQueries: ["get_reservation"],
    tools: [],
    advanceWhen: "SÍ explícito",
    finishWhen: "Handoff humano",
    escalateWhen: "Siempre tras confirmación",
  },
  human: {
    name: "Hablar con un asesor",
    objective: "Escalar conservando contexto",
    required: [],
    optional: ["guestName", "summary"],
    pmsQueries: [],
    tools: [],
    advanceWhen: "Solicitud de asesor",
    finishWhen: "Handoff registrado",
    escalateWhen: "Inmediato",
  },
  payments: {
    name: "Pagos",
    objective: "Consultar saldos/enlaces en PMS; nunca calcular a mano",
    required: ["reservation|guest"],
    optional: [],
    pmsQueries: ["get_payment_status", "get_payment_link"],
    tools: ["get_reservation_payments"],
    advanceWhen: "Reserva identificada",
    finishWhen: "Dato PMS entregado",
    escalateWhen: "Sin registro de pago",
  },
};

const SUBMENU_STEP: Record<MenuGroupId, string> = {
  bookings: "await_submenu_bookings",
  my_reservation: "await_submenu_reservation",
  stay: "await_submenu_stay",
  payments: "await_submenu_payments",
  human: "human_handoff",
};

export function isAwaitingSubmenu(flow: ConciergeConversationFlowState): boolean {
  return Boolean(flow.pendingAction?.startsWith("await_submenu_"));
}

export function submenuGroupFromStep(
  pendingAction: string | null | undefined,
): MenuGroupId | null {
  if (!pendingAction?.startsWith("await_submenu_")) return null;
  const key = pendingAction.replace("await_submenu_", "") as MenuGroupId;
  if (key === "bookings" || key === "my_reservation" || key === "stay" || key === "payments") {
    return key;
  }
  if (pendingAction === "await_submenu_reservation") return "my_reservation";
  return null;
}

type MenuLeaf = {
  n: number;
  label: string;
  workflowId: string;
  intent: ConciergeIntent;
  pendingAction: string | null;
  aliases: RegExp;
};

type MainMenuItem = {
  n: number;
  label: string;
  menuGroup: MenuGroupId;
  aliases: RegExp;
  submenu: MenuLeaf[];
  /** NL that should deep-link past the submenu into a leaf */
  deepAliases?: Array<{ aliases: RegExp; leafIndex: number }>;
};

export const MAIN_MENU: MainMenuItem[] = [
  {
    n: 1,
    label: "Consultar disponibilidad o hacer una reserva",
    menuGroup: "bookings",
    aliases:
      /reservas? y disponib|disponib|alojamiento|hosped|habitaci|apartamento|cotiz|crear (una )?reserva|quiero reservar/i,
    submenu: [
      {
        n: 1,
        label: "Consultar disponibilidad",
        workflowId: "availability",
        intent: "DISPONIBILIDAD",
        pendingAction: "ask_dates_guests",
        aliases: /disponib|hay cupo|tienes algo|cupo|fechas libres/i,
      },
      {
        n: 2,
        label: "Cotizar una estancia",
        workflowId: "quote",
        intent: "COTIZACION",
        pendingAction: "ask_dates_guests",
        aliases: /cotiz|cu[aá]nto (cuesta|vale|sale)|precio|tarifa/i,
      },
      {
        n: 3,
        label: "Crear una reserva",
        workflowId: "booking_create",
        intent: "RESERVA",
        pendingAction: "ask_dates_guests",
        aliases: /crear reserva|hacer (una )?reserva|quiero reservar|reservar/i,
      },
      {
        n: 4,
        label: "Consultar promociones",
        workflowId: "promotions",
        intent: "OTHER",
        pendingAction: "ask_promo_topic",
        aliases: /promoci[oó]n|descuento|oferta|promo/i,
      },
      {
        n: 5,
        label: "Volver al menú principal",
        workflowId: "menu",
        intent: "OTHER",
        pendingAction: WORKFLOW_MENU_STEP,
        aliases: /volver|men[uú]|inicio|atr[aá]s/i,
      },
    ],
  },
  {
    n: 2,
    label: "Información sobre una reserva existente",
    menuGroup: "my_reservation",
    aliases: /mi reserva|datos de (la )?reserva|ya reserv[eé]|tengo (una )?reserva|reserva existente/i,
    submenu: [
      {
        n: 1,
        label: "Ver los datos de mi reserva",
        workflowId: "reservation_info",
        intent: "RESERVA",
        pendingAction: "ask_reservation_lookup",
        aliases: /ver (los )?datos|info(rmaci[oó]n)? (de )?(mi )?reserva/i,
      },
      {
        n: 2,
        label: "Modificar fechas",
        workflowId: "reservation_modify",
        intent: "RESERVA",
        pendingAction: "ask_reservation_lookup",
        aliases: /modificar|cambiar (fechas|reserva)|editar reserva/i,
      },
      {
        n: 3,
        label: "Cancelar reserva",
        workflowId: "cancel",
        intent: "RESERVA",
        pendingAction: "await_cancel_confirm",
        aliases: /cancelar|anular/i,
      },
      {
        n: 4,
        label: "Confirmar pago",
        workflowId: "payments",
        intent: "PAGO",
        pendingAction: "ask_payment_confirm",
        aliases: /confirmar pago|ya pagu[eé]|abono/i,
      },
      {
        n: 5,
        label: "Compartir documentos de ingreso",
        workflowId: "registration_docs",
        intent: "GUEST_REGISTRATION",
        pendingAction: "ask_registration_help",
        aliases: /documento|registro|c[eé]dula|pasaporte|ingreso/i,
      },
      {
        n: 6,
        label: "Volver al menú principal",
        workflowId: "menu",
        intent: "OTHER",
        pendingAction: WORKFLOW_MENU_STEP,
        aliases: /volver|men[uú]|inicio|atr[aá]s/i,
      },
    ],
  },
  {
    n: 3,
    label: "Ayuda durante mi estancia (WiFi, acceso, check-in, check-out, etc.)",
    menuGroup: "stay",
    aliases: /durante (mi )?estancia|estancia|estoy (en|hosped)|ya llegu[eé]|ayuda durante/i,
    submenu: [
      {
        n: 1,
        label: "WiFi",
        workflowId: "wifi",
        intent: "WIFI",
        pendingAction: "ask_property_wifi",
        aliases: /wifi|wi-fi|internet|contrase[nñ]a|clave (de )?(la )?red/i,
      },
      {
        n: 2,
        label: "Ingreso al apartamento (TTLock)",
        workflowId: "ttlock",
        intent: "TTLOCK",
        pendingAction: "ask_access_help",
        aliases: /ttlock|c[oó]digo (de )?puerta|acceso|abrir (la )?puerta|cerradura/i,
      },
      {
        n: 3,
        label: "Check-in / Check-out",
        workflowId: "checkin",
        intent: "CHECKIN",
        pendingAction: "ask_checkin_help",
        aliases: /check[- ]?in|check[- ]?out|hora de (entrada|salida)/i,
      },
      {
        n: 4,
        label: "Reportar un problema",
        workflowId: "issue",
        intent: "COMPLAINT",
        pendingAction: "ask_issue_detail",
        aliases: /problema|da[nñ]o|no funciona|aver[ií]a|queja/i,
      },
      {
        n: 5,
        label: "Solicitar limpieza",
        workflowId: "cleaning",
        intent: "OTHER",
        pendingAction: "ask_cleaning_detail",
        aliases: /limpieza|aseo|clean/i,
      },
      {
        n: 6,
        label: "Turismo y recomendaciones",
        workflowId: "tourism",
        intent: "OTHER",
        pendingAction: "ask_tourism_interest",
        aliases: /turismo|recomend|qu[eé] hacer|restaurante|sitios/i,
      },
      {
        n: 7,
        label: "Contactar un asesor",
        workflowId: "human",
        intent: "COMPLAINT",
        pendingAction: "human_handoff",
        aliases:
          /\b(asesor|humano|operador)\b|hablar con (un |una )?(asesor|humano|persona|alguien)|recepci[oó]n/i,
      },
    ],
  },
  {
    n: 4,
    label: "Pagos y facturación",
    menuGroup: "payments",
    aliases: /pago|pagar|factura|facturaci[oó]n|transferencia|recibo/i,
    submenu: [
      {
        n: 1,
        label: "Ver valor pendiente",
        workflowId: "payments",
        intent: "PAGO",
        pendingAction: "ask_balance_lookup",
        aliases: /pendiente|saldo|debo|cu[aá]nto debo/i,
      },
      {
        n: 2,
        label: "Realizar un pago",
        workflowId: "payments",
        intent: "PAGO",
        pendingAction: "ask_pay_now",
        aliases: /realizar (un )?pago|quiero pagar|pagar ahora/i,
      },
      {
        n: 3,
        label: "Obtener enlace de pago",
        workflowId: "payments",
        intent: "PAGO",
        pendingAction: "ask_payment_link",
        aliases: /enlace|link de pago|pasarela/i,
      },
      {
        n: 4,
        label: "Solicitar factura",
        workflowId: "payments",
        intent: "PAGO",
        pendingAction: "ask_invoice",
        aliases: /factura|facturar|nit/i,
      },
      {
        n: 5,
        label: "Consultar estado de un pago",
        workflowId: "payments",
        intent: "PAGO",
        pendingAction: "ask_payment_status",
        aliases: /estado (de )?(un )?pago|confirmaci[oó]n de pago/i,
      },
    ],
  },
  {
    n: 5,
    label: "Hablar con un asesor",
    menuGroup: "human",
    aliases: /asesor|humano|hablar con|operador|agente (humano)?|recepci[oó]n/i,
    submenu: [],
  },
];

/** @deprecated flat alias — prefer MAIN_MENU; kept for import stability */
export const CONCIERGE_WORKFLOW_MENU = MAIN_MENU.map((m) => ({
  n: m.n,
  label: m.label,
  workflowId: m.menuGroup,
  intent: "OTHER" as ConciergeIntent,
  pendingAction: SUBMENU_STEP[m.menuGroup],
  aliases: m.aliases,
}));

import {
  buildWelcomeAskNameMessage,
  buildPostNameMenuMessage,
  buildVirtualReceptionistWelcome,
  WELCOME_NAME_STEP,
} from "@/modules/ai-concierge/hospitality-protocols/welcome";

export {
  WELCOME_NAME_STEP,
  buildWelcomeAskNameMessage,
  buildPostNameMenuMessage,
  buildVirtualReceptionistWelcome,
};

export function buildMainMenuOptionLines(): string[] {
  return MAIN_MENU.map((o) => `${digitEmoji(o.n)} ${o.label}`);
}

/** Menu-only (name already known) or legacy full block. */
export function buildMainMenuMessage(guestName?: string | null): string {
  const lines = buildMainMenuOptionLines();
  if (guestName?.trim()) {
    return buildPostNameMenuMessage(guestName.trim(), lines);
  }
  // Cold path should use buildWelcomeAskNameMessage; keep ask-name-only here.
  return buildWelcomeAskNameMessage();
}

export function isAwaitingGuestName(
  flow: ConciergeConversationFlowState,
): boolean {
  return flow.pendingAction === WELCOME_NAME_STEP;
}

function digitEmoji(n: number): string {
  const map: Record<number, string> = {
    1: "1️⃣",
    2: "2️⃣",
    3: "3️⃣",
    4: "4️⃣",
    5: "5️⃣",
    6: "6️⃣",
    7: "7️⃣",
  };
  return map[n] ?? String(n);
}

export function buildSubmenuMessage(group: MenuGroupId): string {
  const main = MAIN_MENU.find((m) => m.menuGroup === group);
  if (!main || main.submenu.length === 0) {
    return workflowEntryReply({
      kind: "leaf",
      menuGroup: "human",
      workflowId: "human",
      intent: "COMPLAINT",
      pendingAction: "human_handoff",
      label: "Hablar con un asesor",
    });
  }
  const intro =
    group === "bookings"
      ? "¿Qué deseas hacer?"
      : group === "my_reservation"
        ? "¿Sobre qué necesitas ayuda?"
        : group === "stay"
          ? "¿En qué puedo ayudarte?"
          : "Selecciona una opción:";
  const lines = main.submenu.map((s) => `${s.n}. ${s.label}`);
  return [intro, "", ...lines].join("\n");
}

export function isAwaitingMenuChoice(flow: ConciergeConversationFlowState): boolean {
  return flow.pendingAction === WORKFLOW_MENU_STEP;
}

/** Bare main-menu digit (1–5), optionally with punctuation / emoji variant. */
export function isBareMainMenuDigit(guestMessage: string): boolean {
  return /^([1-5])(?:[.)\s]|️⃣)?$/u.test(guestMessage.trim());
}

/** True when the last agent turn offered the guided main menu. */
export function lastAgentOfferedMainMenu(
  recent: Array<{ role?: string; body?: string }>,
): boolean {
  const lastAgent = [...recent].reverse().find((m) => m.role === "agent");
  const body = lastAgent?.body ?? "";
  if (!body) return false;
  return (
    (/1️⃣/.test(body) && /5️⃣/.test(body)) ||
    (/Consultar disponibilidad o hacer una reserva/i.test(body) &&
      /Hablar con un asesor/i.test(body))
  );
}

export function lastConversationActivityMs(
  recent: Array<{ at?: string }>,
): number | null {
  for (let i = recent.length - 1; i >= 0; i -= 1) {
    const at = recent[i]?.at;
    if (!at) continue;
    const ms = new Date(at).getTime();
    if (Number.isFinite(ms)) return ms;
  }
  return null;
}

/**
 * True when the thread has been idle long enough that a zombie workflow
 * must not block the main menu / NL entry.
 * Unknown timestamps → not idle (preserve mid-flow silence / lock).
 */
export function isConversationIdle(
  recent: Array<{ at?: string }>,
  nowMs = Date.now(),
): boolean {
  const last = lastConversationActivityMs(recent);
  if (last == null) return false;
  return nowMs - last >= CONCIERGE_WORKFLOW_IDLE_MS;
}

/**
 * Expire Context Lock after idle — keep guestName/property facts, clear funnel.
 */
export function unlockStaleWorkflow(input: {
  flow: ConciergeConversationFlowState;
  recent: Array<{ at?: string }>;
  nowMs?: number;
}): ConciergeConversationFlowState {
  if (!isConversationIdle(input.recent, input.nowMs)) return input.flow;
  if (
    input.flow.pendingAction === WORKFLOW_MENU_STEP ||
    input.flow.flow === "menu" ||
    input.flow.flow === "idle" ||
    !input.flow.flow
  ) {
    return {
      topic: "menu",
      flow: "menu",
      pendingAction: WORKFLOW_MENU_STEP,
      awaitingReply: true,
      lastIntent: "OTHER",
    };
  }
  return {
    topic: "menu",
    flow: "menu",
    pendingAction: WORKFLOW_MENU_STEP,
    awaitingReply: true,
    lastIntent: "OTHER",
  };
}

/**
 * Workflow Context Lock — active leaf/submenu until finish, explicit switch, or main menu.
 * Idle threads are never locked (prevents zombie funnels that swallow greetings).
 */
export function isWorkflowContextLocked(
  flow: ConciergeConversationFlowState,
  recent?: Array<{ at?: string }>,
): boolean {
  if (recent && isConversationIdle(recent)) return false;
  if (flow.pendingAction === WORKFLOW_MENU_STEP || flow.flow === "menu") {
    return false;
  }
  if (isAwaitingSubmenu(flow)) return true;
  if (flow.pendingAction) return true;
  if (flow.flow && flow.flow !== "idle") return true;
  return false;
}

/** Alias used by compose — locked leaf/submenu counts as active. */
export function hasActiveWorkflow(
  flow: ConciergeConversationFlowState,
  recent?: Array<{ at?: string }>,
): boolean {
  return isWorkflowContextLocked(flow, recent);
}

export function wantsMainMenu(guestMessage: string): boolean {
  return /^(men[uú]|volver( al men[uú])?|inicio|opciones|atr[aá]s)[\s!.?]*$/i.test(
    guestMessage.trim(),
  );
}

/**
 * Capture display name at main menu without treating it as a workflow choice.
 */
export function tryCaptureGuestName(
  guestMessage: string,
): string | null {
  const t = guestMessage
    .trim()
    .replace(/^(me llamo|soy|mi nombre es)\s+/i, "")
    .trim();
  if (t.length < 2 || t.length > 48) return null;
  if (/^[1-7](?:[.)\s]|️⃣|$)/.test(t)) return null;
  if (
    /disponib|wifi|reserva|pago|check|cancel|asesor|internet|factura|men[uú]|hola|ok|gracias/i.test(
      t,
    )
  ) {
    return null;
  }
  if (!/^[a-záéíóúñü\s'.-]+$/i.test(t)) return null;
  if (t.split(/\s+/).filter(Boolean).length > 4) return null;
  return t.replace(/\s+/g, " ");
}

function leafToRoute(
  leaf: MenuLeaf,
  menuGroup: MenuGroupId,
): ConciergeWorkflowRoute {
  if (leaf.workflowId === "menu") {
    return {
      kind: "main_menu",
      menuGroup: null,
      workflowId: "menu",
      intent: "OTHER",
      pendingAction: WORKFLOW_MENU_STEP,
      label: "Menú principal",
    };
  }
  return {
    kind: "leaf",
    menuGroup,
    workflowId: leaf.workflowId,
    intent: leaf.intent,
    pendingAction: leaf.pendingAction,
    label: leaf.label,
  };
}

function mainToSubmenuRoute(main: MainMenuItem): ConciergeWorkflowRoute {
  if (main.menuGroup === "human") {
    return {
      kind: "leaf",
      menuGroup: "human",
      workflowId: "human",
      intent: "COMPLAINT",
      pendingAction: "human_handoff",
      label: main.label,
    };
  }
  return {
    kind: "submenu",
    menuGroup: main.menuGroup,
    workflowId: main.menuGroup,
    intent: "OTHER",
    pendingAction: SUBMENU_STEP[main.menuGroup],
    label: main.label,
  };
}

/** Deep NL → leaf (skip submenu). Numbers at main → submenu. */
/** Inbound text that mirrors our own main menu (DOM echo / mis-read outbound). */
export function looksLikeMainMenuEcho(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (
    /1️⃣/.test(t) &&
    /5️⃣/.test(t) &&
    /seleccionar una de estas opciones/i.test(t)
  ) {
    return true;
  }
  if (
    /Mucho gusto,/i.test(t) &&
    /1️⃣/.test(t) &&
    /5️⃣/.test(t)
  ) {
    return true;
  }
  if (
    /Mucho gusto,/i.test(t) &&
    /Consultar disponibilidad/i.test(t) &&
    /Hablar con un asesor/i.test(t)
  ) {
    return true;
  }
  return false;
}

export function resolveWorkflowRoute(
  guestMessage: string,
): ConciergeWorkflowRoute | null {
  const text = guestMessage.trim();
  if (!text) return null;

  if (looksLikeMainMenuEcho(text)) return null;

  if (wantsMainMenu(text)) {
    return {
      kind: "main_menu",
      menuGroup: null,
      workflowId: "menu",
      intent: "OTHER",
      pendingAction: WORKFLOW_MENU_STEP,
      label: "Menú principal",
    };
  }

  // Digits 1–5 at main menu → submenu (or human leaf). Bare digit only.
  if (isBareMainMenuDigit(text)) {
    const n = Number(text.match(/^([1-5])/)![1]);
    const main = MAIN_MENU.find((m) => m.n === n);
    if (main) return mainToSubmenuRoute(main);
  }

  // Critical cancel NL → leaf with confirm.
  if (/cancelar|anular (la )?reserva|quiero cancelar/i.test(text)) {
    return {
      kind: "leaf",
      menuGroup: "my_reservation",
      workflowId: "cancel",
      intent: "RESERVA",
      pendingAction: "await_cancel_confirm",
      label: "Cancelar reserva",
    };
  }

  // Deep NL: scan leaf aliases first (WiFi, check-in, etc.) — complements menu.
  for (const main of MAIN_MENU) {
    for (const leaf of main.submenu) {
      if (leaf.workflowId === "menu") continue;
      if (leaf.aliases.test(text)) {
        return leafToRoute(leaf, main.menuGroup);
      }
    }
  }

  // Main-group NL → submenu (e.g. "durante mi estancia").
  for (const main of MAIN_MENU) {
    if (main.aliases.test(text)) return mainToSubmenuRoute(main);
  }

  return null;
}

/** Resolve digit/NL while a submenu is awaiting choice. */
export function resolveSubmenuRoute(
  guestMessage: string,
  flow: ConciergeConversationFlowState,
): ConciergeWorkflowRoute | null {
  const group =
    submenuGroupFromStep(flow.pendingAction) ||
    (flow.flow === "bookings" ||
    flow.flow === "my_reservation" ||
    flow.flow === "stay" ||
    flow.flow === "payments"
      ? (flow.flow as MenuGroupId)
      : null);
  if (!group) return null;

  const main = MAIN_MENU.find((m) => m.menuGroup === group);
  if (!main) return null;

  const text = guestMessage.trim();
  if (wantsMainMenu(text)) {
    return {
      kind: "main_menu",
      menuGroup: null,
      workflowId: "menu",
      intent: "OTHER",
      pendingAction: WORKFLOW_MENU_STEP,
      label: "Menú principal",
    };
  }

  const digit = text.match(/^([1-7])(?:[.)\s]|️⃣)?$/u);
  if (digit) {
    const n = Number(digit[1]);
    const leaf = main.submenu.find((s) => s.n === n);
    if (leaf) return leafToRoute(leaf, group);
  }

  for (const leaf of main.submenu) {
    if (leaf.aliases.test(text)) return leafToRoute(leaf, group);
  }

  // Allow deep jump to another family's leaf (explicit switch from submenu).
  return resolveWorkflowRoute(text);
}

/**
 * Under context lock: only switch if guest explicitly asks another protocol or main menu.
 * Pure acks / vague text / lone menu digits stay locked (caller continues current workflow).
 */
export function resolveContextLockSwitch(
  guestMessage: string,
  flow: ConciergeConversationFlowState,
  recent?: Array<{ at?: string }>,
): ConciergeWorkflowRoute | null {
  if (!isWorkflowContextLocked(flow, recent)) return null;
  if (isAwaitingSubmenu(flow)) return null; // handled by resolveSubmenuRoute

  const text = guestMessage.trim();
  if (wantsMainMenu(text)) {
    return {
      kind: "main_menu",
      menuGroup: null,
      workflowId: "menu",
      intent: "OTHER",
      pendingAction: WORKFLOW_MENU_STEP,
      label: "Menú principal",
    };
  }

  // Lone digits while locked in a leaf = stay (don't hijack as main/submenu).
  if (/^[1-7](?:[.)\s]|️⃣|$)/.test(text) && !/[a-záéíóúñ]{3,}/i.test(text)) {
    return null;
  }

  // v3 Conversation Lock: switch protocol only on explicit NL (or recepción).
  const route = resolveWorkflowRoute(text);
  if (!route || route.kind === "main_menu") return route;
  if (route.workflowId === flow.flow) return null;
  if (route.workflowId === "human") return route;

  const explicitSwitch =
    route.kind === "leaf" &&
    (route.workflowId === "wifi" ||
      route.workflowId === "ttlock" ||
      route.workflowId === "cancel" ||
      route.workflowId === "payments" ||
      /^(mejor |en realidad |ahora )?(necesito|quiero|pásame|pasame|cambia)/i.test(
        text,
      ));

  if (route.kind === "leaf" && explicitSwitch) return route;
  // Submenu opens mid-leaf are not explicit enough — stay in protocol.
  return null;
}

export function workflowEntryReply(
  route: ConciergeWorkflowRoute,
  playbook?: ResolvedAssistantPlaybook | null,
  guestName?: string | null,
): string {
  if (route.kind === "main_menu") {
    if (playbook) {
      if (guestName?.trim()) {
        return resolveMessage(playbook, "welcome_post_name", {
          guestName: guestName.trim(),
          menuLines: buildMainMenuOptionLines().join("\n"),
        });
      }
      return resolveMessage(playbook, "welcome_ask_name");
    }
    return buildMainMenuMessage(guestName);
  }
  if (route.kind === "submenu" && route.menuGroup) {
    return buildSubmenuMessage(route.menuGroup);
  }

  if (playbook) {
    switch (route.workflowId) {
      case "availability":
      case "quote":
      case "booking_create":
        return resolveMessage(playbook, "availability_entry");
      case "human":
        return resolveMessage(playbook, "escalate_human");
      case "wifi":
        return resolveMessage(playbook, "wifi_info");
      case "checkin":
        return resolveMessage(playbook, "checkin_info");
      case "payments":
        return resolveMessage(playbook, "payment_info");
      default:
        break;
    }
  }

  switch (route.workflowId) {
    case "availability":
      return `Perfecto, revisamos disponibilidad juntos.\n\n${buildAvailabilitySlotsAsk({
        checkIn: true,
        checkOut: true,
        guests: true,
      })}`;
    case "quote":
      return `Dale, armemos la cotización.\n\n${buildAvailabilitySlotsAsk({
        checkIn: true,
        checkOut: true,
        guests: true,
      })}`;
    case "booking_create":
      return `Perfecto, avancemos con tu reserva.\n\n${buildAvailabilitySlotsAsk({
        checkIn: true,
        checkOut: true,
        guests: true,
      })}`;
    case "promotions":
      return "Con gusto. Un asesor confirma promociones vigentes. ¿Para qué fechas te interesa?";
    case "wifi":
      return "Con gusto. ¿De qué propiedad es o a nombre de quién está la reserva? Así te paso el WiFi oficial.";
    case "ttlock":
      return "Te ayudo con el ingreso. ¿A nombre de quién está la reserva?";
    case "checkin":
      return "Claro. ¿Es sobre la hora de check-in, check-out o un cambio de horario?";
    case "issue":
      return "Lamento el inconveniente. Cuéntame qué ocurre (y en qué propiedad) para ayudarte bien.";
    case "cleaning":
      return "Entendido. ¿Para qué día y en qué propiedad necesitas la limpieza?";
    case "tourism":
      return "Con gusto. ¿Qué te interesa: restaurantes, planes cercanos o transporte?";
    case "payments":
      return "Te ayudo con el pago usando los datos del sistema. ¿A nombre de quién está la reserva?";
    case "reservation_info":
    case "reservation_modify":
    case "registration_docs":
      return "Perfecto. ¿A nombre de quién está la reserva o tienes el código/confirmación?";
    case "cancel":
      return "Cancelar es una acción importante. ¿Confirmas que deseas cancelar la reserva? Responde SÍ para continuar o NO para mantenerla.";
    case "human":
      return "Entendido. Voy a conectar tu conversación con recepción para que un asesor continúe. Conservaré lo que ya compartiste para que no tengas que repetirlo.";
    default:
      return `Listo. Continuemos con: ${route.label}.`;
  }
}

export function describeWorkflowProgress(flow: ConciergeConversationFlowState): {
  workflowId: string | null;
  step: string | null;
  locked: boolean;
  nextHint: string | null;
  complete: boolean;
} {
  const locked = isWorkflowContextLocked(flow);
  const workflowId =
    flow.flow && flow.flow !== "idle" && flow.flow !== "menu" ? flow.flow : null;
  const step = flow.pendingAction;
  const def = workflowId ? WORKFLOW_DEFINITIONS[workflowId] : null;
  const nextHint =
    step === WORKFLOW_MENU_STEP
      ? "Nombre y/o opción 1–5 / consulta NL"
      : isAwaitingSubmenu(flow)
        ? "Elegir subopción o escribir consulta"
        : step === "ask_dates_guests" ||
            step === "ask_check_in" ||
            step === "ask_check_out" ||
            step === "ask_guests"
          ? "Capturar fechas y huéspedes del mismo paso"
          : step === "await_cancel_confirm"
                ? "Confirmar cancelación SÍ/NO"
                : def?.advanceWhen ?? (step ? `Completar: ${step}` : null);
  const complete =
    !flow.awaitingReply &&
    (!step || step === "human_finalize" || step === "done");
  return { workflowId, step, locked, nextHint, complete };
}

export function resolveCancelConfirm(
  guestMessage: string,
  flow: ConciergeConversationFlowState,
): { reply: string; flow: ConciergeConversationFlowState; escalate: boolean } | null {
  if (flow.pendingAction !== "await_cancel_confirm") return null;
  const text = guestMessage.trim();
  if (/^(no|nop|nel|mejor no|mant[eé]n|dejar)[\s!.?]*$/i.test(text)) {
    return {
      reply: "Listo, mantenemos la reserva. Escribe menú si quieres otras opciones.",
      escalate: false,
      flow: {
        topic: "menu",
        flow: "menu",
        pendingAction: WORKFLOW_MENU_STEP,
        awaitingReply: true,
        lastIntent: "OTHER",
      },
    };
  }
  if (
    /^(s[ií]|ok|okay|dale|confirmo|quiero cancelar)[\s!.?]*$/i.test(text) ||
    /\b(s[ií]|confirmo)\b.*cancel/i.test(text)
  ) {
    return {
      reply:
        "Confirmado. Un asesor humano completará la cancelación; yo no la ejecuto automáticamente. Conservaré el contexto de esta conversación.",
      escalate: true,
      flow: {
        topic: "Cancelación",
        flow: "cancel",
        pendingAction: "human_handoff",
        awaitingReply: false,
        lastIntent: "RESERVA",
      },
    };
  }
  return {
    reply:
      "Para cancelar necesito una confirmación clara: responde SÍ para continuar o NO para mantener la reserva.",
    escalate: false,
    flow,
  };
}
