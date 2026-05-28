"use server";

import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";
import {
  getReservationEmailEnrichmentSummary,
  manualReservationEnrichmentResolver,
  type ManualReservationEnrichmentResult,
  type ReservationEmailEnrichmentSummary,
} from "@/services/reservations/reservation-email-enrichment.service";

export async function getReservationEmailEnrichmentAction(
  reservationId: string,
): Promise<ReservationEmailEnrichmentSummary | null> {
  const scope = await requireTenantDataScope();
  return getReservationEmailEnrichmentSummary(scope, reservationId);
}

export async function manualReservationEnrichmentResolverAction(
  reservationId: string,
): Promise<ManualReservationEnrichmentResult> {
  const scope = await requireTenantDataScope();
  return manualReservationEnrichmentResolver(scope, reservationId);
}
