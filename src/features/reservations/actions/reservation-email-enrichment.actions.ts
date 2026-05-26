"use server";

import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";
import {
  getReservationEmailEnrichmentSummary,
  type ReservationEmailEnrichmentSummary,
} from "@/services/reservations/reservation-email-enrichment.service";

export async function getReservationEmailEnrichmentAction(
  reservationId: string,
): Promise<ReservationEmailEnrichmentSummary | null> {
  const scope = await requireTenantDataScope();
  return getReservationEmailEnrichmentSummary(scope, reservationId);
}
