import "server-only";

import { randomUUID } from "node:crypto";
import type { Prisma, ProspectingLead } from "@prisma/client";
import { db } from "@/lib/db";
import {
  buildConversationGuide,
  type ConversationGuide,
} from "@/lib/prospecting/prospecting-conversation-guide";
import {
  buildLeadScoreReasons,
  getFollowUpUrgency,
  type FollowUpUrgency,
} from "@/lib/prospecting/prospecting-intelligence";
import { computeProspectingScore } from "@/lib/prospecting/prospecting-score";
import type {
  ProspectingActivityEntry,
  ProspectingActivityType,
  ProspectingLeadDetail,
} from "@/services/prospecting/prospecting-crm.types";

function parseActivityLog(value: Prisma.JsonValue): ProspectingActivityEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is ProspectingActivityEntry =>
      Boolean(entry) &&
      typeof entry === "object" &&
      !Array.isArray(entry) &&
      typeof (entry as ProspectingActivityEntry).id === "string" &&
      typeof (entry as ProspectingActivityEntry).type === "string" &&
      typeof (entry as ProspectingActivityEntry).summary === "string" &&
      typeof (entry as ProspectingActivityEntry).at === "string",
  );
}

export function serializeProspectingLeadDetail(row: ProspectingLead): ProspectingLeadDetail {
  const base = {
    id: row.id,
    businessName: row.businessName,
    phone: row.phone,
    website: row.website,
    email: row.email,
    address: row.address,
    city: row.city,
    hostUrl: row.hostUrl,
    listingsCount: row.listingsCount,
    rating: row.rating,
    reviews: row.reviews,
    category: row.category,
    source: row.source,
    status: row.status,
    notes: row.notes,
    lastContactDate: row.lastContactDate?.toISOString() ?? null,
    nextFollowUpDate: row.nextFollowUpDate?.toISOString() ?? null,
    followUpCount: row.followUpCount,
    outreachMessage: row.outreachMessage,
    leadType: row.leadType,
    estimatedSophistication: row.estimatedSophistication,
    potentialPragmaFit: row.potentialPragmaFit,
    activityLog: parseActivityLog(row.activityLog),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };

  const scored = computeProspectingScore({
    phone: base.phone,
    website: base.website,
    rating: base.rating,
    reviews: base.reviews,
    listingsCount: base.listingsCount,
    category: base.category,
    leadType: base.leadType,
    potentialPragmaFit: base.potentialPragmaFit,
    estimatedSophistication: base.estimatedSophistication,
    status: base.status,
  });

  const intelligence = {
    phone: base.phone,
    website: base.website,
    rating: base.rating,
    reviews: base.reviews,
    listingsCount: base.listingsCount,
    category: base.category,
    leadType: base.leadType,
    potentialPragmaFit: base.potentialPragmaFit,
    estimatedSophistication: base.estimatedSophistication,
    airbnbScore: scored.airbnbScore,
    status: base.status,
    priority: scored.priority,
    outreachMessage: base.outreachMessage,
    nextFollowUpDate: base.nextFollowUpDate,
    prospectingScore: scored.score,
  };

  return {
    ...base,
    prospectingScore: scored.score,
    priority: scored.priority,
    airbnbScore: scored.airbnbScore,
    scoreReasons: buildLeadScoreReasons(intelligence),
    followUpUrgency: getFollowUpUrgency(base.nextFollowUpDate),
    conversationGuide: buildConversationGuide(intelligence),
  };
}

export async function getProspectingLeadForOrg(
  organizationId: string,
  leadId: string,
): Promise<ProspectingLead | null> {
  return db.prospectingLead.findFirst({
    where: { id: leadId, organizationId },
  });
}

export async function appendProspectingActivity(
  organizationId: string,
  leadId: string,
  input: { type: ProspectingActivityType; summary: string },
): Promise<ProspectingLeadDetail | null> {
  const lead = await getProspectingLeadForOrg(organizationId, leadId);
  if (!lead) return null;

  const entry: ProspectingActivityEntry = {
    id: randomUUID(),
    type: input.type,
    summary: input.summary.trim().slice(0, 500),
    at: new Date().toISOString(),
  };

  const activityLog = [...parseActivityLog(lead.activityLog), entry].slice(-100);

  const updated = await db.prospectingLead.update({
    where: { id: lead.id },
    data: { activityLog },
  });

  return serializeProspectingLeadDetail(updated);
}

export async function updateProspectingLeadCrm(
  organizationId: string,
  leadId: string,
  input: {
    status?: ProspectingLead["status"];
    notes?: string | null;
    nextFollowUpDate?: Date | null;
    outreachMessage?: string | null;
    leadType?: ProspectingLead["leadType"];
    estimatedSophistication?: ProspectingLead["estimatedSophistication"];
    potentialPragmaFit?: ProspectingLead["potentialPragmaFit"];
    logActivity?: { type: ProspectingActivityType; summary: string };
    touchContact?: boolean;
    incrementFollowUp?: boolean;
  },
): Promise<ProspectingLeadDetail | null> {
  const lead = await getProspectingLeadForOrg(organizationId, leadId);
  if (!lead) return null;

  const data: Prisma.ProspectingLeadUpdateInput = {};
  const activities: ProspectingActivityEntry[] = parseActivityLog(lead.activityLog);

  if (input.status !== undefined && input.status !== lead.status) {
    data.status = input.status;
    activities.push({
      id: randomUUID(),
      type: "STATUS_CHANGE",
      summary: `Estado: ${lead.status} → ${input.status}`,
      at: new Date().toISOString(),
    });
  }

  if (input.notes !== undefined) {
    const trimmed = input.notes?.trim() || null;
    if (trimmed !== lead.notes) {
      data.notes = trimmed;
      if (trimmed) {
        activities.push({
          id: randomUUID(),
          type: "NOTE_ADDED",
          summary: trimmed.slice(0, 200),
          at: new Date().toISOString(),
        });
      }
    }
  }

  if (input.nextFollowUpDate !== undefined) {
    data.nextFollowUpDate = input.nextFollowUpDate;
    if (input.nextFollowUpDate) {
      activities.push({
        id: randomUUID(),
        type: "FOLLOW_UP_SCHEDULED",
        summary: `Seguimiento programado: ${input.nextFollowUpDate.toISOString().slice(0, 10)}`,
        at: new Date().toISOString(),
      });
    }
  }

  if (input.outreachMessage !== undefined) {
    data.outreachMessage = input.outreachMessage?.trim().slice(0, 4000) || null;
  }

  if (input.leadType !== undefined) data.leadType = input.leadType;
  if (input.estimatedSophistication !== undefined) {
    data.estimatedSophistication = input.estimatedSophistication;
  }
  if (input.potentialPragmaFit !== undefined) {
    data.potentialPragmaFit = input.potentialPragmaFit;
  }

  if (input.touchContact) {
    data.lastContactDate = new Date();
  }

  if (input.incrementFollowUp) {
    data.followUpCount = { increment: 1 };
  }

  if (input.logActivity) {
    activities.push({
      id: randomUUID(),
      type: input.logActivity.type,
      summary: input.logActivity.summary.trim().slice(0, 500),
      at: new Date().toISOString(),
    });
  }

  data.activityLog = activities.slice(-100);

  const updated = await db.prospectingLead.update({
    where: { id: lead.id },
    data,
  });

  return serializeProspectingLeadDetail(updated);
}
