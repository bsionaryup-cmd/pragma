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

function isGoogleMapsUrl(value: string): boolean {
  try {
    const host = new URL(value.startsWith("http") ? value : `https://${value}`).hostname
      .toLowerCase();
    return host === "google.com" || host.endsWith(".google.com");
  } catch {
    return value.toLowerCase().includes("google.com/maps");
  }
}

function pickWebsite(item: Record<string, unknown>): string | null {
  for (const key of ["website", "webSite", "companyWebsite"]) {
    const value = pickString(item, [key]);
    if (value && !isGoogleMapsUrl(value)) return value;
  }
  return null;
}

export function normalizeProviderItem(
  item: Record<string, unknown>,
  source: ProspectingLeadSourceValue,
): NormalizedLead | null {
  const businessName = pickString(item, ["title", "name", "businessName"]);
  if (!businessName) return null;

  return {
    businessName,
    phone: pickString(item, ["phone", "phoneUnformatted", "phoneNumber"]),
    website: pickWebsite(item),
    email: pickString(item, ["email", "emails"]),
    address: pickString(item, ["address", "street", "fullAddress", "formattedAddress"]),
    rating: pickNumber(item, ["totalScore", "rating", "stars"]),
    reviews: pickInteger(item, ["reviewsCount", "reviews", "reviewCount"]),
    category: pickString(item, ["categoryName", "category", "type"]),
    source,
  };
}

export function normalizeGoogleMapsItem(item: Record<string, unknown>): NormalizedLead | null {
  return normalizeProviderItem(item, "GOOGLE_MAPS");
}
