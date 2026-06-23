import type { NormalizedLead } from "@/lib/apify/types";

/** Booking provider stub — returns NormalizedLead[] when implemented. */
export async function scrapeBooking(_searchTerm: string): Promise<NormalizedLead[]> {
  return [];
}
