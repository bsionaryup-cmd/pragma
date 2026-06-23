export const PROSPECTING_LEAD_STATUSES = [
  "NEW",
  "HOT",
  "WARM",
  "COLD",
  "CONTACTED",
  "QUALIFIED",
  "CLOSED",
] as const;

export type ProspectingLeadStatus = (typeof PROSPECTING_LEAD_STATUSES)[number];

/** Future CRM lifecycle fields — not persisted yet. */
export type LeadScore = {
  value: number;
  rationale: string | null;
};

export type LeadTag = {
  id: string;
  label: string;
  color: string | null;
};

export type LeadActivity = {
  id: string;
  type: string;
  summary: string;
  occurredAt: string;
};

export type LeadNotes = {
  body: string;
  updatedAt: string;
};

export type LeadLifecycleSnapshot = {
  status: ProspectingLeadStatus;
  score: LeadScore | null;
  tags: LeadTag[];
  activities: LeadActivity[];
  notes: LeadNotes | null;
};
