/**
 * Default message templates — client-safe (no db, no workflow-menu chain).
 */
import type { AssistantMessageTemplates } from "@/modules/assistant-platform/types";
import { CONCIERGE_IDENTITY_LINE_GUEST } from "@/modules/ai-concierge/hospitality-protocols/welcome";
import { buildAvailabilitySlotsAsk } from "@/modules/ai-concierge/dialogue/stay-slot-ask";

function softContinueHint(pendingAction: string | null): string {
  switch (pendingAction) {
    case "ask_dates_guests":
    case "ask_check_in":
    case "ask_check_out":
    case "ask_guests":
    case "ask_dates":
      return "Seguimos con tu reserva. ¿Me compartes fecha de entrada, fecha de salida y número de huéspedes?";
    case "ask_property":
      return "Seguimos. ¿De qué propiedad o zona quieres consultar disponibilidad?";
    case "await_confirm":
      return "Seguimos. ¿Te armo la reserva con las fechas que revisamos? Responde sí o no.";
    case "ask_guest_name":
      return "Seguimos. ¿Me compartes el nombre completo del titular de la reserva?";
    case "ask_guest_email":
      return "Seguimos. ¿Cuál es tu correo? Si prefieres sin correo, escribe «continuar».";
    case "await_final_confirm":
      return "Seguimos. ¿Confirmas que cree la reserva? Responde «sí» o «no».";
    default:
      return "Seguimos con tu solicitud. ¿Me confirmas el dato pendiente de este paso?";
  }
}

export function defaultMessageTemplates(): AssistantMessageTemplates {
  return {
    identity_line: CONCIERGE_IDENTITY_LINE_GUEST,
    welcome_ask_name: [
      "¡Hola! 👋",
      "",
      CONCIERGE_IDENTITY_LINE_GUEST,
      "",
      "Antes de comenzar, ¿me regalas tu nombre?",
    ].join("\n"),
    welcome_post_name: [
      "Mucho gusto, {{guestName}}. 😊",
      "",
      "Estoy listo para ayudarte.",
      "Puedes escribir directamente lo que necesitas o, si lo prefieres, seleccionar una de estas opciones:",
      "",
      "{{menuLines}}",
    ].join("\n"),
    ask_dates_guests: buildAvailabilitySlotsAsk({
      checkIn: true,
      checkOut: true,
      guests: true,
    }),
    ask_dates_guests_partial: buildAvailabilitySlotsAsk({
      checkIn: true,
      checkOut: true,
      guests: true,
    }),
    soft_continue_ask_dates: softContinueHint("ask_dates_guests"),
    soft_continue_await_confirm: softContinueHint("await_confirm"),
    soft_continue_ask_guest_name: softContinueHint("ask_guest_name"),
    soft_continue_ask_guest_email: softContinueHint("ask_guest_email"),
    soft_continue_await_final_confirm: softContinueHint("await_final_confirm"),
    soft_continue_post_booking: softContinueHint("booking_created"),
    soft_continue_default: softContinueHint(null),
    availability_entry: [
      "Perfecto, revisamos disponibilidad juntos.",
      "",
      buildAvailabilitySlotsAsk({
        checkIn: true,
        checkOut: true,
        guests: true,
      }),
    ].join("\n"),
    escalate_human:
      "Entendido. Voy a conectar tu conversación con recepción para que un asesor continúe. Conservaré lo que ya compartiste para que no tengas que repetirlo.",
    payment_info:
      "Te ayudo con el pago usando los datos del sistema. ¿A nombre de quién está la reserva?",
    wifi_info:
      "Con gusto. ¿De qué propiedad es o a nombre de quién está la reserva? Así te paso el WiFi oficial.",
    checkin_info:
      "Claro. ¿Es sobre la hora de check-in, check-out o un cambio de horario?",
    checkout_info:
      "Claro. ¿Necesitas la hora de check-out o un late check-out?",
  };
}
