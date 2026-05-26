import type { SafeCommunicationIntent } from "@/modules/airbnb-email/types";

export function detectSafeCommunicationIntent(
  messageBody: string,
): SafeCommunicationIntent {
  const text = messageBody.toLowerCase();

  if (
    /early check|check-?in temprano|llegar antes|early arrival/.test(text)
  ) {
    return "EARLY_CHECKIN";
  }
  if (/transporte|taxi|airport|aeropuerto|pickup|recogida/.test(text)) {
    return "TRANSPORT";
  }
  if (
    /llego a las|arrival time|hora de llegada|flight|vuelo|landing/.test(text)
  ) {
    return "ARRIVAL_SUPPORT";
  }
  if (/reseña|review|respond|responder/.test(text)) {
    return "REVIEW_RESPONSE";
  }
  if (/urgent|urgente|problema|problem|cancel|reembolso|refund/.test(text)) {
    return "REQUIRES_ATTENTION";
  }

  return null;
}
