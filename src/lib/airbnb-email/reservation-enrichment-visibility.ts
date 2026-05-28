/** Subset used to decide if reservation detail should show Airbnb Email Enrichment. */
export type ReservationEmailEnrichmentVisibilityInput = {
  emailEnriched: boolean;
  emailEventCount: number;
  linkedAuditCount: number;
  propertyAuditCount: number;
  payoutCount: number;
  communicationCount: number;
  reviewCount: number;
  pendingTaskCount: number;
  manualReviewPending: boolean;
  lastEventKind: string | null;
  lastProcessedAt: string | null;
  lastMatchConfidence: number | null;
};

export function reservationHasVisibleEmailEnrichment(
  detail: ReservationEmailEnrichmentVisibilityInput,
): boolean {
  return (
    detail.emailEnriched ||
    detail.emailEventCount > 0 ||
    detail.linkedAuditCount > 0 ||
    detail.propertyAuditCount > 0 ||
    detail.payoutCount > 0 ||
    detail.communicationCount > 0 ||
    detail.reviewCount > 0 ||
    detail.pendingTaskCount > 0 ||
    detail.manualReviewPending ||
    Boolean(detail.lastEventKind) ||
    Boolean(detail.lastProcessedAt) ||
    detail.lastMatchConfidence != null
  );
}
