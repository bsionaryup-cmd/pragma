import "server-only";

import { db } from "@/lib/db";
import type { ProspectingLead, ProspectingLeadSource } from "@prisma/client";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export type ProspectingLeadRow = {
  id: string;
  businessName: string;
  phone: string | null;
  website: string | null;
  email: string | null;
  address: string | null;
  rating: number | null;
  reviews: number | null;
  category: string | null;
  source: ProspectingLeadSource;
  createdAt: string;
};

export type ListProspectingLeadsResult = {
  items: ProspectingLeadRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

function serializeLead(row: ProspectingLead): ProspectingLeadRow {
  return {
    id: row.id,
    businessName: row.businessName,
    phone: row.phone,
    website: row.website,
    email: row.email,
    address: row.address,
    rating: row.rating,
    reviews: row.reviews,
    category: row.category,
    source: row.source,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listProspectingLeads(input: {
  organizationId: string;
  page?: number;
  pageSize?: number;
}): Promise<ListProspectingLeadsResult> {
  const page = Math.max(1, Math.floor(input.page ?? 1));
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Math.floor(input.pageSize ?? DEFAULT_PAGE_SIZE)),
  );
  const skip = (page - 1) * pageSize;

  const [total, rows] = await Promise.all([
    db.prospectingLead.count({ where: { organizationId: input.organizationId } }),
    db.prospectingLead.findMany({
      where: { organizationId: input.organizationId },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
  ]);

  return {
    items: rows.map(serializeLead),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
