import type { NormalizedLead } from "@/lib/apify/types";

type DedupFields = Pick<NormalizedLead, "businessName" | "phone" | "website">;

function normalizeWebsite(value: string | null): string {
  if (!value) return "";
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
}

function normalizePhone(value: string | null): string {
  if (!value) return "";
  return value.replace(/\D/g, "");
}

export function buildLeadDedupKey(lead: DedupFields): string {
  const businessName = lead.businessName.trim().toLowerCase();
  const phone = normalizePhone(lead.phone);
  const website = normalizeWebsite(lead.website);
  return `${businessName}|${phone}|${website}`;
}
