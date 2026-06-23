export const PROSPECTING_LEAD_SOURCES = [
  "GOOGLE_MAPS",
  "AIRBNB",
  "INSTAGRAM",
  "FACEBOOK",
  "BOOKING",
  "LINKEDIN",
] as const;

export type ProspectingLeadSourceValue = (typeof PROSPECTING_LEAD_SOURCES)[number];

export type NormalizedLead = {
  businessName: string;
  phone: string | null;
  website: string | null;
  email: string | null;
  address: string | null;
  rating: number | null;
  reviews: number | null;
  category: string | null;
  source: ProspectingLeadSourceValue;
};
