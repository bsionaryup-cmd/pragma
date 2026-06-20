"use server";

import { requirePermission } from "@/lib/auth";
import { getReservationInquiryForInbox } from "@/services/reservations/reservation-inquiry.service";

export async function getReservationInquiryDetailAction(pendingActivityId: string) {
  try {
    await requirePermission("reservations:read");
    const inquiry = await getReservationInquiryForInbox(pendingActivityId);
    if (!inquiry) {
      return { success: false as const, error: "Consulta no encontrada" };
    }
    return { success: true as const, inquiry };
  } catch {
    return { success: false as const, error: "No se pudo cargar la consulta" };
  }
}
