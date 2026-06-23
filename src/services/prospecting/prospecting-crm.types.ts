import type {
  ProspectingFitLevel,
  ProspectingLeadSource,
  ProspectingLeadStatus,
  ProspectingLeadType,
} from "@prisma/client";

export type ProspectingActivityType =
  | "STATUS_CHANGE"
  | "NOTE_ADDED"
  | "OUTREACH_GENERATED"
  | "INSIGHTS_GENERATED"
  | "CONTACT_WHATSAPP"
  | "CONTACT_WEBSITE"
  | "PHONE_COPIED"
  | "FOLLOW_UP_SCHEDULED";

export type ProspectingActivityEntry = {
  id: string;
  type: ProspectingActivityType;
  summary: string;
  at: string;
};

export type ProspectingLeadDetail = {
  id: string;
  businessName: string;
  phone: string | null;
  website: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  hostUrl: string | null;
  listingsCount: number | null;
  rating: number | null;
  reviews: number | null;
  category: string | null;
  source: ProspectingLeadSource;
  status: ProspectingLeadStatus;
  notes: string | null;
  lastContactDate: string | null;
  nextFollowUpDate: string | null;
  followUpCount: number;
  outreachMessage: string | null;
  leadType: ProspectingLeadType | null;
  estimatedSophistication: ProspectingFitLevel | null;
  potentialPragmaFit: ProspectingFitLevel | null;
  activityLog: ProspectingActivityEntry[];
  createdAt: string;
  updatedAt: string;
};

export const PROSPECTING_LEAD_STATUSES: ProspectingLeadStatus[] = [
  "NEW",
  "CONTACTED",
  "RESPONDED",
  "INTERESTED",
  "FOLLOW_UP",
  "DEMO",
  "CUSTOMER",
  "NOT_INTERESTED",
  "ARCHIVED",
];

export const PROSPECTING_STATUS_LABELS: Record<ProspectingLeadStatus, string> = {
  NEW: "Nuevo",
  CONTACTED: "Contactado",
  RESPONDED: "Respondió",
  INTERESTED: "Interesado",
  FOLLOW_UP: "Seguimiento",
  DEMO: "Demo",
  CUSTOMER: "Cliente",
  NOT_INTERESTED: "No interesado",
  ARCHIVED: "Archivado",
};

export const PROSPECTING_LEAD_TYPE_LABELS: Record<ProspectingLeadType, string> = {
  PROPERTY_MANAGER: "Property Manager",
  CO_HOST: "Co-Host",
  HOST: "Host",
  HOTEL: "Hotel",
  HOSTEL: "Hostel",
  VACATION_RENTAL_OPERATOR: "Operador alquiler vacacional",
  UNKNOWN: "Desconocido",
};

export const PROSPECTING_FIT_LABELS: Record<ProspectingFitLevel, string> = {
  LOW: "Bajo",
  MEDIUM: "Medio",
  HIGH: "Alto",
};
