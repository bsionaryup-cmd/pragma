import { ReservationStatus } from "@prisma/client";
import type { NovedadesStayStageLabel } from "@/services/novedades/novedades-inbox.types";

export type InboxThreadStatus = "consulta" | "reservada" | "hospedado" | "finalizada";

export const INBOX_THREAD_STATUS_LABELS: Record<InboxThreadStatus, string> = {
  consulta: "Consulta",
  reservada: "Reservada",
  hospedado: "Hospedado",
  finalizada: "Finalizada",
};

export function resolveInboxThreadStatus(input: {
  isInquiry: boolean;
  reservationStatus?: ReservationStatus | null;
  stayStage?: NovedadesStayStageLabel | null;
}): InboxThreadStatus {
  if (input.isInquiry) return "consulta";

  const status = input.reservationStatus;
  if (
    status === ReservationStatus.CHECKED_IN ||
    status === ReservationStatus.CHECKOUT_TODAY
  ) {
    return "hospedado";
  }

  if (
    status === ReservationStatus.CHECKED_OUT ||
    input.stayStage === "Finalizada" ||
    input.stayStage === "Día de salida"
  ) {
    return "finalizada";
  }

  if (input.stayStage === "En estadía" || input.stayStage === "Día de check-in") {
    return "hospedado";
  }

  return "reservada";
}
