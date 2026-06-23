import type { ProspectingLeadStatus } from "@/lib/apify/lead-lifecycle.types";

export type PipelineStage = {
  id: string;
  label: string;
  status: ProspectingLeadStatus;
  order: number;
};

export type FollowUpTask = {
  id: string;
  leadId: string;
  dueAt: string;
  channel: "WHATSAPP" | "EMAIL" | "CALL";
  completed: boolean;
};

export type WhatsAppConversationRef = {
  leadId: string;
  externalThreadId: string | null;
};

export type EmailCampaignRef = {
  leadId: string;
  campaignId: string | null;
};

export type AiQualificationResult = {
  leadId: string;
  fitScore: number;
  summary: string;
};

/** Future CRM module contracts — extensibility only, no persistence yet. */
export type ProspectingCrmBlueprint = {
  pipeline: PipelineStage[];
  followUps: FollowUpTask[];
  whatsapp: WhatsAppConversationRef[];
  emailCampaigns: EmailCampaignRef[];
  aiQualification: AiQualificationResult[];
};
