/**
 * Reservation Adapter — sole create gate from Conversation Engine workflows.
 *
 * Does NOT call Prisma directly.
 * Does NOT invent reservation IDs.
 * Reuses runCommercialBookingFlow → create_direct_reservation tool
 * (scoped path; wizard createReservation() requires Clerk session).
 */
import "server-only";

import type { TenantDataScope } from "@/lib/platform/tenant-data-scope";
import { runCommercialBookingFlow } from "@/modules/ai-concierge/commercial/booking-flow";
import type {
  ReservationAdapterInput,
  ReservationAdapterResult,
} from "@/modules/ai-concierge/conversation-engine/types";

export type { ReservationAdapterInput, ReservationAdapterResult };

/**
 * Create a Direct reservation from a completed workflow.
 * Workflows must call only this function (not tools/Prisma).
 */
export async function createReservationViaAdapter(
  input: ReservationAdapterInput & { scope: TenantDataScope },
): Promise<ReservationAdapterResult> {
  const booked = await runCommercialBookingFlow(input);
  return {
    ok: booked.ok,
    reservationId: booked.reservationId,
    quoteSummary: booked.quoteSummary,
    steps: booked.steps,
    via: "commercial_booking_flow",
  };
}
