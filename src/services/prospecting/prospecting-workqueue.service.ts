import "server-only";

import { db } from "@/lib/db";
import { rankContactNext } from "@/lib/prospecting/prospecting-intelligence";
import { serializeProspectingLeadDetail } from "@/services/prospecting/prospecting-crm.service";
import type { ProspectingLeadRow } from "@/services/prospecting/prospecting-lead.service";

const CONTACT_QUEUE_FETCH = 150;
const DEFAULT_CONTACT_LIMIT = 8;

export async function listContactNextLeads(input: {
  organizationId: string;
  limit?: number;
}): Promise<ProspectingLeadRow[]> {
  const limit = Math.min(20, Math.max(1, Math.floor(input.limit ?? DEFAULT_CONTACT_LIMIT)));

  const rows = await db.prospectingLead.findMany({
    where: {
      organizationId: input.organizationId,
      status: { notIn: ["CUSTOMER", "NOT_INTERESTED", "ARCHIVED"] },
      phone: { not: null },
    },
    take: CONTACT_QUEUE_FETCH,
    orderBy: { updatedAt: "desc" },
  });

  return rows
    .map(serializeProspectingLeadDetail)
    .filter((lead) => lead.phone?.trim())
    .sort((a, b) => {
      const rankA = rankContactNext({
        phone: a.phone,
        website: a.website,
        rating: a.rating,
        reviews: a.reviews,
        listingsCount: a.listingsCount,
        category: a.category,
        leadType: a.leadType,
        potentialPragmaFit: a.potentialPragmaFit,
        estimatedSophistication: a.estimatedSophistication,
        airbnbScore: a.airbnbScore,
        status: a.status,
        priority: a.priority,
        outreachMessage: a.outreachMessage,
        nextFollowUpDate: a.nextFollowUpDate,
        prospectingScore: a.prospectingScore,
      });
      const rankB = rankContactNext({
        phone: b.phone,
        website: b.website,
        rating: b.rating,
        reviews: b.reviews,
        listingsCount: b.listingsCount,
        category: b.category,
        leadType: b.leadType,
        potentialPragmaFit: b.potentialPragmaFit,
        estimatedSophistication: b.estimatedSophistication,
        airbnbScore: b.airbnbScore,
        status: b.status,
        priority: b.priority,
        outreachMessage: b.outreachMessage,
        nextFollowUpDate: b.nextFollowUpDate,
        prospectingScore: b.prospectingScore,
      });
      return rankB - rankA;
    })
    .slice(0, limit);
}
