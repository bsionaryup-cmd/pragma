/**
 * Human availability / quote dialogue — speech-driven, slot-aware.
 * Server tools (wire / reservation adapter) load via dynamic import so unit
 * tests of early gates do not pull `server-only`.
 */
import type { TenantDataScope } from "@/lib/platform/tenant-data-scope";
import type { ConciergeFactMap } from "@/modules/ai-concierge/memory/fact-memory";
import {
  collectSlotsFromTranscript,
  formatDateEs,
  isLikelyAgentEcho,
  shouldIgnoreSlotSource,
} from "@/modules/ai-concierge/dialogue/slot-extract";
import { applyEscalationIntent } from "@/modules/ai-concierge/conversation-engine/escalation";
import {
  validateEmailOrSkip,
  validateGuestName,
  validateYesNo,
} from "@/modules/ai-concierge/conversation-engine/validators";
import type { ReservationAdapterResult } from "@/modules/ai-concierge/conversation-engine/types";
import { buildAvailabilitySlotsAsk } from "@/modules/ai-concierge/dialogue/stay-slot-ask";

export { buildAvailabilitySlotsAsk } from "@/modules/ai-concierge/dialogue/stay-slot-ask";

export type AvailabilityDialogueResult = {
  handled: boolean;
  reply: string | null;
  factsPatch: ConciergeFactMap;
  flow: string;
  pendingAction: string | null;
  path: "deterministic" | "needs_tools" | "escalate";
  toolsUsed: string[];
};

function isCommercialIntent(intent: string): boolean {
  return (
    intent === "DISPONIBILIDAD" ||
    intent === "COTIZACION" ||
    intent === "RESERVA" ||
    intent === "OTHER"
  );
}

/** Guest text must mention booking — leftover slots alone must NOT reopen the funnel. */
function guestSignalsAvailability(text: string): boolean {
  return /disponib|apartament|hosped|fech|cotiz|reserv|precio|cu[aá]nto|vacante|libre|noche|\bpersonas?\b|\bhu[eé]spedes?\b|habitaci/i.test(
    text,
  );
}

function guestSignalsBookingConfirm(text: string): boolean {
  const t = text.trim();
  // Long blobs are usually mis-read agent bubbles (root cause of 2nd out-of-context send).
  if (t.length > 80) return false;
  return (
    /\b(s[ií]|ok|okay|dale|confirmo|reservemos|quiero reservar|hagamos la reserva|de una|armala|ármala|arme la reserva)\b/i.test(
      t,
    ) && !/\bno\b/i.test(t)
  );
}

function splitGuestName(full: string): {
  guestFirstName: string;
  guestLastName?: string;
} {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  const guestFirstName = parts[0] || full.trim();
  const guestLastName =
    parts.length > 1 ? parts.slice(1).join(" ") : undefined;
  return { guestFirstName, guestLastName };
}

const PURE_GREETING_OR_ACK =
  /^(hola+|holi+|ola+|wenas+|buenas?(?: (?:tardes|noches|días|dias))?|hey+|hi+|hello+|gracias+|ok+|okay+|vale+|👍|🙏|👌)[\s!.?]*$/i;

export type AvailabilityDialogueDeps = {
  /** Injected in tests — defaults to Reservation Adapter dynamic import. */
  createReservation?: (input: {
    scope: TenantDataScope;
    allowedPropertyIds?: string[];
    allowedTools?: string[];
    propertyId: string;
    checkIn: string;
    checkOut: string;
    guestFirstName: string;
    guestLastName?: string;
    guestEmail?: string;
    adults?: number;
  }) => Promise<ReservationAdapterResult>;
  /** Injected in tests — defaults to Phase6 read registry dynamic import. */
  invokeAvailabilityLookup?: (input: {
    scope: TenantDataScope;
    conversationId: string;
    allowedPropertyIds?: string[];
    allowedTools?: string[];
    propertyId: string;
    checkIn: string;
    checkOut: string;
  }) => Promise<{
    toolsUsed: string[];
    available: boolean;
    quoteSummary: string | null;
    stayTotal: number | null;
    failed: boolean;
  }>;
};

/**
 * Next human reply for availability funnel. Invokes read tools when slots complete.
 */
export async function runAvailabilityDialogue(input: {
  intent: string;
  guestMessage: string;
  recentGuestBodies: string[];
  facts: ConciergeFactMap;
  scope: TenantDataScope;
  propertyId?: string | null;
  allowedPropertyIds?: string[];
  allowedTools?: string[];
  conversationId: string;
  pendingAction?: string | null;
  /** Last agent outbound — used to ignore DOM echo as guest. */
  lastAgentBody?: string | null;
  /** Assistant Studio override for stay-slot ask (full missing set). */
  askDatesGuestsMessage?: string | null;
  deps?: AvailabilityDialogueDeps;
}): Promise<AvailabilityDialogueResult> {
  const empty: AvailabilityDialogueResult = {
    handled: false,
    reply: null,
    factsPatch: {},
    flow: "idle",
    pendingAction: null,
    path: "deterministic",
    toolsUsed: [],
  };

  const guestText = input.guestMessage.trim();
  const guestNameFact =
    typeof input.facts.guestName === "string" ? input.facts.guestName : null;

  // Never treat our own ask/quote bubble (or template) as guest slot input.
  if (
    shouldIgnoreSlotSource(guestText) ||
    isLikelyAgentEcho(guestText, input.lastAgentBody)
  ) {
    return empty;
  }

  // Post-booking: do not re-enter availability on leftover facts.
  if (
    input.pendingAction === "booking_created" ||
    input.facts.reservationCreated === true
  ) {
    if (PURE_GREETING_OR_ACK.test(guestText) || !guestSignalsAvailability(guestText)) {
      return empty;
    }
  }

  // Fase 6 — never leave blocked: menu / reception / end escape.
  const escape = applyEscalationIntent(guestText, guestNameFact);
  if (
    escape &&
    (input.pendingAction === "ask_guest_name" ||
      input.pendingAction === "ask_guest_email" ||
      input.pendingAction === "await_final_confirm" ||
      input.pendingAction === "await_confirm" ||
      input.pendingAction === "ask_check_in" ||
      input.pendingAction === "ask_check_out" ||
      input.pendingAction === "ask_guests" ||
      input.pendingAction === "ask_dates" ||
      input.pendingAction === "ask_dates_guests" ||
      input.pendingAction === "ask_property" ||
      input.pendingAction === "offer_alternative" ||
      input.pendingAction === "human_review" ||
      input.facts.flowTopic === "availability")
  ) {
    return {
      handled: true,
      reply: escape.reply,
      factsPatch: escape.factsPatch,
      flow: escape.flow,
      pendingAction: escape.pendingAction,
      path: escape.path,
      toolsUsed: [],
    };
  }

  // P0: pure greetings/acks must never resume a stale booking funnel.
  // "sí" is not a pure greeting — confirm gates still advance via validators below.
  if (!guestText || PURE_GREETING_OR_ACK.test(guestText)) {
    return empty;
  }

  // Bare main-menu digits must not be treated as guest-count while the menu is up.
  if (
    /^[1-5](?:[.)\s]|️⃣)?$/u.test(guestText) &&
    input.lastAgentBody &&
    ((/1️⃣/.test(input.lastAgentBody) && /5️⃣/.test(input.lastAgentBody)) ||
      (/Consultar disponibilidad o hacer una reserva/i.test(
        input.lastAgentBody,
      ) &&
        /Hablar con un asesor/i.test(input.lastAgentBody)))
  ) {
    return empty;
  }

  // P0: ignore our own outbound if the DOM mis-labels it as guest.
  if (
    /nombre completo del titular|Todavía no está creada|Aquí el concierge|Soy el concierge|¿En qué te puedo ayudar|Dime cómo te ayudo|Dime, ¿en qué te ayudo/i.test(
      guestText,
    )
  ) {
    return empty;
  }

  // v2.2 — collect titular name, then optional email, then final confirm + create.
  if (input.pendingAction === "ask_guest_name") {
    const nameResult = validateGuestName(guestText);
    if (nameResult.ok && typeof nameResult.value === "string") {
      const name = nameResult.value;
      return {
        handled: true,
        reply: `Gracias, ${name}. ¿Cuál es tu correo para enviarte la confirmación? Si prefieres continuar sin correo, escribe «continuar».`,
        factsPatch: {
          flowTopic: "availability",
          guestName: name,
          reservationWorkflowStep: "GUEST_DATA",
        },
        flow: "availability",
        pendingAction: "ask_guest_email",
        path: "deterministic",
        toolsUsed: [],
      };
    }
    return {
      handled: true,
      reply:
        (!nameResult.ok && nameResult.reprompt) ||
        "¿Me compartes el nombre completo del titular de la reserva?",
      factsPatch: {
        flowTopic: "availability",
        reservationWorkflowStep: "GUEST_DATA",
      },
      flow: "availability",
      pendingAction: "ask_guest_name",
      path: "deterministic",
      toolsUsed: [],
    };
  }

  if (input.pendingAction === "ask_guest_email") {
    const emailResult = validateEmailOrSkip(guestText);
    if (emailResult.ok) {
      const guestName =
        typeof input.facts.guestName === "string"
          ? input.facts.guestName
          : "el titular";
      const checkIn =
        typeof input.facts.checkIn === "string" ? input.facts.checkIn : null;
      const checkOut =
        typeof input.facts.checkOut === "string" ? input.facts.checkOut : null;
      const guests =
        typeof input.facts.guests === "number" ? input.facts.guests : null;
      const dateBit =
        checkIn && checkOut
          ? ` del ${formatDateEs(checkIn)} al ${formatDateEs(checkOut)}`
          : "";
      const guestBit = guests ? ` (${guests} personas)` : "";
      const email =
        emailResult.value !== "skip" && typeof emailResult.value === "string"
          ? emailResult.value
          : null;
      return {
        handled: true,
        reply: `Perfecto. ¿Confirmas que cree la reserva en PRAGMA a nombre de ${guestName}${dateBit}${guestBit}? Responde «sí» para crearla o «no» para cancelar. Todavía no está creada.`,
        factsPatch: {
          flowTopic: "availability",
          reservationWorkflowStep: "CONFIRM",
          ...(email ? { guestEmail: email } : {}),
        },
        flow: "availability",
        pendingAction: "await_final_confirm",
        path: "deterministic",
        toolsUsed: [],
      };
    }
    return {
      handled: true,
      reply: emailResult.ok
        ? "Necesito un correo válido o «continuar»."
        : emailResult.reprompt,
      factsPatch: {
        flowTopic: "availability",
        reservationWorkflowStep: "GUEST_DATA",
      },
      flow: "availability",
      pendingAction: "ask_guest_email",
      path: "deterministic",
      toolsUsed: [],
    };
  }

  if (input.pendingAction === "await_final_confirm") {
    const yn = validateYesNo(guestText);
    if (yn.ok && yn.value === "no") {
      return {
        handled: true,
        reply:
          "Listo, no creé la reserva. ¿Revisamos otras fechas o te ayudo con otra consulta? Escribe menú para ver opciones.",
        factsPatch: {
          flowTopic: "availability",
          bookingConfirmed: false,
          reservationWorkflowStep: "MENU",
        },
        flow: "menu",
        pendingAction: "await_menu_choice",
        path: "deterministic",
        toolsUsed: [],
      };
    }
    if (!yn.ok || yn.value !== "yes") {
      return {
        handled: true,
        reply: yn.ok
          ? "Responde «sí» para crear la reserva o «no» para cancelar."
          : yn.reprompt,
        factsPatch: {
          flowTopic: "availability",
          reservationWorkflowStep: "CONFIRM",
        },
        flow: "availability",
        pendingAction: "await_final_confirm",
        path: "deterministic",
        toolsUsed: [],
      };
    }

    const guestName =
      typeof input.facts.guestName === "string" ? input.facts.guestName : null;
    const staySlots = collectSlotsFromTranscript(
      input.guestMessage,
      input.recentGuestBodies,
      {},
    );
    const checkIn = staySlots.checkIn;
    const checkOut = staySlots.checkOut;
    const guests = staySlots.guests;
    const propertyId =
      input.propertyId ||
      (typeof input.facts.propertyId === "string"
        ? input.facts.propertyId
        : null) ||
      input.allowedPropertyIds?.[0] ||
      null;
    const guestEmail =
      typeof input.facts.guestEmail === "string"
        ? input.facts.guestEmail
        : undefined;

    if (!guestName || !checkIn || !checkOut || !guests || !propertyId) {
      return {
        handled: true,
        reply: buildAvailabilitySlotsAsk({
          checkIn: !checkIn,
          checkOut: !checkOut,
          guests: !guests,
        }),
        factsPatch: {
          flowTopic: "availability",
          reservationWorkflowStep: "CHECKIN",
          checkIn: null,
          checkOut: null,
          guests: null,
          bookingConfirmed: false,
        },
        flow: "availability",
        pendingAction: "ask_dates_guests",
        path: "needs_tools",
        toolsUsed: [],
      };
    }

    const { guestFirstName, guestLastName } = splitGuestName(guestName);
    const createFn =
      input.deps?.createReservation ??
      (async (args) => {
        const mod = await import(
          "@/modules/ai-concierge/conversation-engine/reservation-adapter"
        );
        return mod.createReservationViaAdapter(args);
      });

    const booked = await createFn({
      scope: input.scope,
      allowedPropertyIds: input.allowedPropertyIds,
      allowedTools: input.allowedTools,
      propertyId,
      checkIn,
      checkOut,
      guestFirstName,
      guestLastName,
      guestEmail,
      adults: guests,
    });

    const toolsUsed = booked.steps.map((s) => s.step);

    if (!booked.ok || !booked.reservationId) {
      const createStep = booked.steps.find((s) => s.step === "create_reservation");
      const detail =
        createStep?.error ||
        booked.steps.find((s) => !s.ok)?.error ||
        "No se pudo completar el registro";
      return {
        handled: true,
        reply: `Todavía no pude crear la reserva en el sistema (${detail}). Un asesor humano lo revisa con los datos que ya compartiste y te confirma. No digas que está creada hasta que te lo confirmemos.`,
        factsPatch: {
          flowTopic: "availability",
          lastToolOutcome: "FAILED",
          bookingConfirmed: true,
          guestName,
          reservationWorkflowStep: "FINISHED",
        },
        flow: "availability",
        pendingAction: "human_review",
        path: "escalate",
        toolsUsed: ["reservation_adapter", "create_direct_reservation", ...toolsUsed],
      };
    }

    const quoteBit = booked.quoteSummary
      ? ` ${booked.quoteSummary}`
      : "";
    return {
      handled: true,
      reply: `Listo. Ya creé tu reserva en PRAGMA a nombre de ${guestName} del ${formatDateEs(checkIn)} al ${formatDateEs(checkOut)} (${guests} personas).${quoteBit} Referencia: ${booked.reservationId}. Si necesitas WiFi, check-in o pagos, escribe la opción o menú.`,
      factsPatch: {
        flowTopic: "availability",
        lastToolOutcome: "SUCCESS",
        bookingConfirmed: true,
        guestName,
        reservationId: booked.reservationId,
        reservationCreated: true,
        reservationWorkflowStep: "FINISHED",
        ...(guestEmail ? { guestEmail } : {}),
      },
      flow: "availability",
      pendingAction: "booking_created",
      path: "deterministic",
      toolsUsed: ["reservation_adapter", "create_direct_reservation", ...toolsUsed],
    };
  }

  if (
    !isCommercialIntent(input.intent) &&
    !guestSignalsAvailability(guestText) &&
    input.pendingAction !== "ask_dates" &&
    input.pendingAction !== "ask_guests" &&
    input.pendingAction !== "ask_dates_guests" &&
    input.pendingAction !== "ask_check_in" &&
    input.pendingAction !== "ask_check_out" &&
    input.pendingAction !== "ask_property" &&
    input.pendingAction !== "await_confirm" &&
    input.pendingAction !== "ask_guest_name" &&
    input.pendingAction !== "ask_guest_email" &&
    input.pendingAction !== "await_final_confirm"
  ) {
    return empty;
  }

  const slots = collectSlotsFromTranscript(
    input.guestMessage,
    input.recentGuestBodies,
    input.facts,
  );

  // Require an explicit guest signal OR commercial intent — never facts alone.
  // Active workflow steps always continue (slot capture).
  const topicHit =
    guestSignalsAvailability(guestText) ||
    input.intent === "DISPONIBILIDAD" ||
    input.intent === "COTIZACION" ||
    input.intent === "RESERVA" ||
    input.pendingAction === "ask_dates" ||
    input.pendingAction === "ask_guests" ||
    input.pendingAction === "ask_dates_guests" ||
    input.pendingAction === "ask_check_in" ||
    input.pendingAction === "ask_check_out" ||
    input.pendingAction === "ask_property" ||
    input.pendingAction === "await_confirm" ||
    input.pendingAction === "ask_guest_name" ||
    input.pendingAction === "ask_guest_email" ||
    input.pendingAction === "await_final_confirm" ||
    (input.facts.flowTopic === "availability" &&
      guestSignalsBookingConfirm(guestText));

  if (!topicHit) return empty;

  const factsPatch: ConciergeFactMap = {
    flowTopic: "availability",
  };
  if (slots.guests) factsPatch.guests = slots.guests;
  if (slots.checkIn) factsPatch.checkIn = slots.checkIn;
  if (slots.checkOut) factsPatch.checkOut = slots.checkOut;

  // REGLA 5–8: one logical step — ask every missing stay slot together; never guess.
  const missingCheckIn = !slots.checkIn;
  const missingCheckOut = !slots.checkOut;
  const missingGuests = !slots.guests;
  if (missingCheckIn || missingCheckOut || missingGuests) {
    const allMissing =
      missingCheckIn && missingCheckOut && missingGuests;
    const studioAsk =
      allMissing && input.askDatesGuestsMessage?.trim()
        ? input.askDatesGuestsMessage.trim()
        : null;
    return {
      handled: true,
      reply:
        studioAsk ??
        buildAvailabilitySlotsAsk({
          checkIn: missingCheckIn,
          checkOut: missingCheckOut,
          guests: missingGuests,
        }),
      factsPatch,
      flow: "availability",
      pendingAction: "ask_dates_guests",
      path: "deterministic",
      toolsUsed: [],
    };
  }

  // Slots complete → lookup
  const propertyId =
    input.propertyId ||
    (typeof input.facts.propertyId === "string"
      ? input.facts.propertyId
      : null) ||
    input.allowedPropertyIds?.[0] ||
    null;

  if (!propertyId) {
    return {
      handled: true,
      reply: `Tengo las fechas del ${formatDateEs(slots.checkIn!)} al ${formatDateEs(slots.checkOut!)} para ${slots.guests} personas. ¿De qué propiedad o zona te gustaría consultar?`,
      factsPatch,
      flow: "availability",
      pendingAction: "ask_property",
      path: "needs_tools",
      toolsUsed: [],
    };
  }

  const lookup =
    input.deps?.invokeAvailabilityLookup ??
    (async (args) => {
      const { createPhase6ReadToolRegistry } = await import(
        "@/modules/ai-concierge/tools/read/wire"
      );
      const registry = createPhase6ReadToolRegistry({
        scope: args.scope,
        conversationId: args.conversationId,
        allowedPropertyIds: args.allowedPropertyIds,
        allowedTools: args.allowedTools,
      });
      const toolsUsed: string[] = [];
      const availability = await registry.invoke({
        toolName: "search_availability",
        args: {
          propertyId: args.propertyId,
          checkIn: args.checkIn,
          checkOut: args.checkOut,
        },
        currentPhase: 6,
      });
      toolsUsed.push("search_availability");
      if (!availability.result?.ok) {
        return {
          toolsUsed,
          available: false,
          quoteSummary: null,
          stayTotal: null,
          failed: true,
        };
      }
      const available = Boolean(
        (availability.result.data as { available?: boolean })?.available,
      );
      if (!available) {
        return {
          toolsUsed,
          available: false,
          quoteSummary: null,
          stayTotal: null,
          failed: false,
        };
      }
      const quote = await registry.invoke({
        toolName: "calculate_stay_quote",
        args: {
          propertyId: args.propertyId,
          checkIn: args.checkIn,
          checkOut: args.checkOut,
        },
        currentPhase: 6,
      });
      toolsUsed.push("calculate_stay_quote");
      const quoteSummary =
        quote.result?.ok &&
        typeof (quote.result.data as { quoteSummary?: string })?.quoteSummary ===
          "string"
          ? (quote.result.data as { quoteSummary: string }).quoteSummary
          : null;
      const stayTotal = quote.result?.ok
        ? (quote.result.data as { stayTotal?: number })?.stayTotal ?? null
        : null;
      return {
        toolsUsed,
        available: true,
        quoteSummary,
        stayTotal,
        failed: false,
      };
    });

  const lookupResult = await lookup({
    scope: input.scope,
    conversationId: input.conversationId,
    allowedPropertyIds: input.allowedPropertyIds,
    allowedTools: input.allowedTools,
    propertyId,
    checkIn: slots.checkIn!,
    checkOut: slots.checkOut!,
  });
  const toolsUsed = lookupResult.toolsUsed;

  if (lookupResult.failed) {
    return {
      handled: true,
      reply:
        "Todavía estoy verificando esas fechas; aún no tengo confirmación. ¿Me confirmas el nombre de la propiedad o me das un momento con el equipo?",
      factsPatch: {
        ...factsPatch,
        propertyId,
        lastToolOutcome: "FAILED",
        reservationWorkflowStep: "AVAILABILITY",
      },
      flow: "availability",
      pendingAction: "human_review",
      path: "escalate",
      toolsUsed,
    };
  }

  if (!lookupResult.available) {
    return {
      handled: true,
      reply: `Para el ${formatDateEs(slots.checkIn!)} al ${formatDateEs(slots.checkOut!)} (${slots.guests} personas) no tengo disponibilidad en esa propiedad. ¿Te sirve cambiar un par de días o revisar otra opción?`,
      factsPatch: {
        ...factsPatch,
        propertyId,
        availabilitySummary: "unavailable",
        reservationWorkflowStep: "AVAILABILITY",
      },
      flow: "availability",
      pendingAction: "offer_alternative",
      path: "deterministic",
      toolsUsed,
    };
  }

  const quoteSummary = lookupResult.quoteSummary;
  const stayTotal = lookupResult.stayTotal;

  let reply: string;
  if (quoteSummary) {
    reply = `Sí hay disponibilidad del ${formatDateEs(slots.checkIn!)} al ${formatDateEs(slots.checkOut!)} para ${slots.guests} personas. ${quoteSummary} ¿Te armo la reserva?`;
  } else if (stayTotal != null) {
    reply = `Sí hay disponibilidad del ${formatDateEs(slots.checkIn!)} al ${formatDateEs(slots.checkOut!)} para ${slots.guests} personas. La tarifa estimada es ${stayTotal}. ¿Te armo la reserva?`;
  } else {
    reply = `Sí hay disponibilidad del ${formatDateEs(slots.checkIn!)} al ${formatDateEs(slots.checkOut!)} para ${slots.guests} personas. ¿Te armo la cotización formal / reserva?`;
  }

  if (slots.confirmedIntent && guestSignalsBookingConfirm(guestText)) {
    // Never claim the reservation already exists — ask for titular first.
    // Only when THIS guest message confirms (not stale facts.bookingConfirmed).
    reply = `Perfecto. Para armar la reserva del ${formatDateEs(slots.checkIn!)} al ${formatDateEs(slots.checkOut!)} (${slots.guests} personas) necesito el nombre completo del titular. ¿Me lo compartes? Todavía no está creada.`;
    factsPatch.bookingConfirmed = true;
  }

  return {
    handled: true,
    reply,
    factsPatch: {
      ...factsPatch,
      propertyId,
      availabilitySummary: "available",
      reservationWorkflowStep:
        slots.confirmedIntent && guestSignalsBookingConfirm(guestText)
          ? "GUEST_DATA"
          : "SUMMARY",
      ...(quoteSummary ? { quoteSummary } : {}),
      ...(stayTotal != null ? { stayTotal } : {}),
    },
    flow: "availability",
    pendingAction:
      slots.confirmedIntent && guestSignalsBookingConfirm(guestText)
        ? "ask_guest_name"
        : "await_confirm",
    path: "deterministic",
    toolsUsed,
  };
}

