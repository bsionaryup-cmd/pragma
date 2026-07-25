/**
 * Message Renderer — builds guest-facing copy only.
 * No business logic / no tool calls.
 */
export {
  buildMainMenuMessage,
  buildSubmenuMessage,
  workflowEntryReply,
} from "@/modules/ai-concierge/dialogue/workflow-menu";

export {
  sanitizeGuestOutbound,
  humanClarifyMissingFacts,
} from "@/modules/ai-concierge/engine/guest-copy";

import { buildMainMenuMessage } from "@/modules/ai-concierge/dialogue/workflow-menu";
import { buildAvailabilitySlotsAsk } from "@/modules/ai-concierge/dialogue/stay-slot-ask";
import type { ReservationWorkflowStep } from "@/modules/ai-concierge/conversation-engine/types";

/** Default prompts for reservation step machine (renderer-only). */
export function renderReservationStepPrompt(
  step: ReservationWorkflowStep,
  guestName?: string | null,
): string {
  switch (step) {
    case "WELCOME":
    case "MENU":
      return buildMainMenuMessage(guestName);
    case "PEOPLE":
    case "CHECKIN":
    case "CHECKOUT":
    case "RESERVATION":
    case "AVAILABILITY":
      return buildAvailabilitySlotsAsk({
        checkIn: true,
        checkOut: true,
        guests: true,
      });
    case "SUMMARY":
      return "Te resumo la estancia. ¿Quieres que la reserve? Responde SÍ o NO.";
    case "CONFIRM":
      return "Para confirmar la reserva responde SÍ. Si quieres cancelar, responde NO.";
    case "GUEST_DATA":
      return "¿A nombre de quién registramos la reserva? (nombre completo)";
    case "CREATE_RESERVATION":
      return "Estoy registrando tu reserva en PRAGMA…";
    case "FINISHED":
      return "Listo. Si necesitas otra cosa, escribe menú.";
    default:
      return buildMainMenuMessage(guestName);
  }
}
