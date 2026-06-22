import type { Prospect as PrismaProspect } from "@prisma/client";

export type ProspectStatus =
  | "NEW"
  | "CONTACTED"
  | "QUALIFIED"
  | "DEMO_BOOKED"
  | "PROPOSAL"
  | "CUSTOMER"
  | "LOST";

export type ProspectSource =
  | "GOOGLE_MAPS"
  | "AIRBNB"
  | "INSTAGRAM"
  | "LINKEDIN"
  | "MANUAL";

export type ProspectSegment =
  | "SHORT_TERM_OPERATOR"
  | "PROPERTY_MANAGER"
  | "CO_HOST"
  | "INVESTOR"
  | "HOTEL"
  | "OTHER";

export type IcpTier = "enterprise" | "high" | "medium" | "low";

export type ProspectRow = {
  id: string;
  companyName: string;
  phone: string | null;
  website: string | null;
  instagram: string | null;
  city: string | null;
  estimatedProperties: number | null;
  score: number | null;
  status: ProspectStatus;
  source: ProspectSource;
  segment: ProspectSegment;
  notes: string | null;
  archived: boolean;
  createdAt: string;
};

/** @deprecated Pipeline mock only — F4 will migrate */
export type MockProspect = Omit<ProspectRow, "archived" | "notes">;

export type ProspectFormValues = {
  companyName: string;
  phone: string;
  website: string;
  instagram: string;
  city: string;
  segment: ProspectSegment;
  source: ProspectSource;
  notes: string;
  status: ProspectStatus;
};

export const PROSPECT_STATUSES: ProspectStatus[] = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "DEMO_BOOKED",
  "PROPOSAL",
  "CUSTOMER",
  "LOST",
];

export const PIPELINE_COLUMN_STATUSES: ProspectStatus[] = [
  "NEW",
  "CONTACTED",
  "DEMO_BOOKED",
  "CUSTOMER",
  "LOST",
];

/** Editable pipeline statuses (UI + form). Demo maps to DEMO_BOOKED in DB. */
export const PROSPECT_PIPELINE_STATUSES: ProspectStatus[] = [...PIPELINE_COLUMN_STATUSES];

export const PROSPECT_SOURCES: ProspectSource[] = [
  "GOOGLE_MAPS",
  "AIRBNB",
  "INSTAGRAM",
  "LINKEDIN",
  "MANUAL",
];

export const PROSPECT_SEGMENTS: ProspectSegment[] = [
  "SHORT_TERM_OPERATOR",
  "PROPERTY_MANAGER",
  "CO_HOST",
  "INVESTOR",
  "HOTEL",
  "OTHER",
];

const PROSPECT_STATUS_LABELS: Record<ProspectStatus, string> = {
  NEW: "Nuevo",
  CONTACTED: "Contactado",
  QUALIFIED: "Calificado",
  DEMO_BOOKED: "Demo",
  PROPOSAL: "Propuesta",
  CUSTOMER: "Cliente",
  LOST: "Perdido",
};

const PROSPECT_SOURCE_LABELS: Record<ProspectSource, string> = {
  GOOGLE_MAPS: "Google Maps",
  AIRBNB: "Airbnb",
  INSTAGRAM: "Instagram",
  LINKEDIN: "LinkedIn",
  MANUAL: "Manual",
};

const PROSPECT_SEGMENT_LABELS: Record<ProspectSegment, string> = {
  SHORT_TERM_OPERATOR: "Operador STR",
  PROPERTY_MANAGER: "Administrador",
  CO_HOST: "Co-host",
  INVESTOR: "Inversor",
  HOTEL: "Hotel",
  OTHER: "Otro",
};

const ICP_TIER_LABELS: Record<IcpTier, string> = {
  enterprise: "Empresa",
  high: "Alto",
  medium: "Medio",
  low: "Bajo",
};

export function serializeProspectRow(prospect: PrismaProspect): ProspectRow {
  return {
    id: prospect.id,
    companyName: prospect.companyName,
    phone: prospect.phone,
    website: prospect.website,
    instagram: prospect.instagram,
    city: prospect.city,
    estimatedProperties: prospect.estimatedProperties,
    score: prospect.score,
    status: prospect.status,
    source: prospect.source,
    segment: prospect.segment,
    notes: prospect.notes,
    archived: prospect.archived,
    createdAt: prospect.createdAt.toISOString(),
  };
}

export function getIcpTier(score: number | null | undefined): IcpTier | null {
  if (score == null || !Number.isFinite(score)) return null;
  if (score >= 95) return "enterprise";
  if (score >= 80) return "high";
  if (score >= 60) return "medium";
  return "low";
}

export function getIcpTierLabel(tier: IcpTier): string {
  return ICP_TIER_LABELS[tier];
}

export function formatProspectStatus(status: ProspectStatus): string {
  return PROSPECT_STATUS_LABELS[status];
}

export function formatProspectSource(source: ProspectSource): string {
  return PROSPECT_SOURCE_LABELS[source];
}

export function formatProspectSegment(segment: ProspectSegment): string {
  return PROSPECT_SEGMENT_LABELS[segment];
}

/** Maps legacy DB statuses into the 5 pipeline columns. */
export function pipelineColumnStatusForProspect(status: ProspectStatus): ProspectStatus {
  if (status === "QUALIFIED") return "CONTACTED";
  if (status === "PROPOSAL") return "DEMO_BOOKED";
  return status;
}

/** Initial status value for the edit form (5 pipeline values only). */
export function prospectStatusForEditForm(status: ProspectStatus): ProspectStatus {
  const mapped = pipelineColumnStatusForProspect(status);
  if (PROSPECT_PIPELINE_STATUSES.includes(mapped)) {
    return mapped;
  }
  return "NEW";
}

export function emptyProspectFormValues(): ProspectFormValues {
  return {
    companyName: "",
    phone: "",
    website: "",
    instagram: "",
    city: "",
    segment: "PROPERTY_MANAGER",
    source: "MANUAL",
    notes: "",
    status: "NEW",
  };
}

export function prospectToFormValues(prospect: ProspectRow): ProspectFormValues {
  return {
    companyName: prospect.companyName,
    phone: prospect.phone ?? "",
    website: prospect.website ?? "",
    instagram: prospect.instagram ?? "",
    city: prospect.city ?? "",
    segment: prospect.segment,
    source: prospect.source,
    notes: prospect.notes ?? "",
    status: prospectStatusForEditForm(prospect.status),
  };
}
