import "server-only";

import type { ProspectingLeadSource } from "@prisma/client";
import { db } from "@/lib/db";
import { buildLeadDedupKey } from "@/lib/apify/lead-dedup";
import type { NormalizedLead } from "@/lib/apify/types";

export async function saveLeads(
  organizationId: string,
  leads: NormalizedLead[],
): Promise<{ inserted: number; skipped: number }> {
  const existing = await db.prospectingLead.findMany({
    where: { organizationId },
    select: { businessName: true, phone: true, website: true },
  });

  const seen = new Set(existing.map((row) => buildLeadDedupKey(row)));
  const batch: Array<{
    organizationId: string;
    businessName: string;
    phone: string | null;
    website: string | null;
    email: string | null;
    address: string | null;
    rating: number | null;
    reviews: number | null;
    category: string | null;
    source: ProspectingLeadSource;
  }> = [];

  let skipped = 0;

  for (const lead of leads) {
    const key = buildLeadDedupKey(lead);
    if (seen.has(key)) {
      skipped += 1;
      continue;
    }

    seen.add(key);
    batch.push({
      organizationId,
      businessName: lead.businessName.trim().slice(0, 200),
      phone: lead.phone?.trim().slice(0, 64) || null,
      website: lead.website?.trim().slice(0, 512) || null,
      email: lead.email?.trim().slice(0, 320) || null,
      address: lead.address?.trim().slice(0, 512) || null,
      rating: lead.rating,
      reviews: lead.reviews,
      category: lead.category?.trim().slice(0, 120) || null,
      source: lead.source as ProspectingLeadSource,
    });
  }

  if (batch.length === 0) {
    return { inserted: 0, skipped };
  }

  const result = await db.prospectingLead.createMany({ data: batch });
  return { inserted: result.count, skipped };
}
