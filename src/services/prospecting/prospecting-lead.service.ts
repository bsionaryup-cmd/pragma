import "server-only";

import { db } from "@/lib/db";
import type { ProspectingLead, ProspectingLeadSource } from "@prisma/client";
import {
  serializeProspectingLeadDetail,
} from "@/services/prospecting/prospecting-crm.service";
import type { ProspectingLeadDetail } from "@/services/prospecting/prospecting-crm.types";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export type ProspectingLeadRow = ProspectingLeadDetail;

export type ListProspectingLeadsResult = {
  items: ProspectingLeadRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

function serializeLead(row: ProspectingLead): ProspectingLeadRow {
  return serializeProspectingLeadDetail(row);
}

export async function listProspectingLeads(input: {
  organizationId: string;
  page?: number;
  pageSize?: number;
  status?: ProspectingLead["status"];
}): Promise<ListProspectingLeadsResult> {
  const page = Math.max(1, Math.floor(input.page ?? 1));
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Math.floor(input.pageSize ?? DEFAULT_PAGE_SIZE)),
  );
  const skip = (page - 1) * pageSize;
  const where = {
    organizationId: input.organizationId,
    ...(input.status ? { status: input.status } : {}),
  };

  const [total, rows] = await Promise.all([
    db.prospectingLead.count({ where }),
    db.prospectingLead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
  ]);

  const items = rows.map(serializeLead).sort((a, b) => {
    if (b.prospectingScore !== a.prospectingScore) {
      return b.prospectingScore - a.prospectingScore;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return {
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getProspectingLeadRow(
  organizationId: string,
  leadId: string,
): Promise<ProspectingLeadRow | null> {
  const row = await db.prospectingLead.findFirst({
    where: { id: leadId, organizationId },
  });
  return row ? serializeLead(row) : null;
}

export type { ProspectingLeadSource };
