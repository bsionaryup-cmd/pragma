import type { NormalizedLead, ProspectingLeadSourceValue } from "@/lib/apify/types";

function pickString(item: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }
  return null;
}

function pickNumber(item: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function pickInteger(item: Record<string, unknown>, keys: string[]): number | null {
  const value = pickNumber(item, keys);
  if (value === null) return null;
  return Math.max(0, Math.floor(value));
}

export function normalizeProviderItem(
  item: Record<string, unknown>,
  source: ProspectingLeadSourceValue,
): NormalizedLead | null {
  const businessName = pickString(item, ["title", "name", "businessName"]);
  if (!businessName) return null;

  return {
    businessName,
    phone: pickString(item, ["phone", "phoneUnformatted"]),
    website: pickString(item, ["website", "url"]),
    email: pickString(item, ["email"]),
    address: pickString(item, ["address", "street", "fullAddress"]),
    rating: pickNumber(item, ["totalScore", "rating", "stars"]),
    reviews: pickInteger(item, ["reviewsCount", "reviews", "reviewCount"]),
    category: pickString(item, ["categoryName", "category", "type"]),
    source,
  };
}

export function normalizeGoogleMapsItem(item: Record<string, unknown>): NormalizedLead | null {
  return normalizeProviderItem(item, "GOOGLE_MAPS");
}
