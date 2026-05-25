import { formatPropertyUnit } from "@/lib/property-display";

function extractUnitNumberFromText(text: string): string | null {
  const value = text.trim();
  if (!value) return null;

  if (/^\d{2,4}$/.test(value)) return value;

  const priceLabsPrefix = value.match(
    /(?:^|\s)(?:apartamento|apto|apt\.?)\s*(\d{2,4})\s*(?:--|·|[-–—]|$)/i,
  );
  if (priceLabsPrefix) return priceLabsPrefix[1];

  const aptoMatch = value.match(
    /(?:apartamento|apto|apt\.?|unidad)\s*[#.]?\s*(\d{2,4})\b/i,
  );
  if (aptoMatch) return aptoMatch[1];

  const leadingMatch = value.match(/^(?:#|n[°º.]?\s*)?(\d{2,4})\b(?:\s|[-–—]|$)/i);
  if (leadingMatch) return leadingMatch[1];

  const embedded = value.match(/\b([67-9]\d{2})\b/);
  if (embedded) return embedded[1];

  const trailingMatch = value.match(/\b(\d{3,4})\s*$/);
  if (trailingMatch) return trailingMatch[1];

  return null;
}

/** Número de apartamento para sidebar del calendario (unitNumber o extracción del nombre). */
export function resolveCalendarUnitLabel(input: {
  name: string;
  unitNumber?: string | null;
  listingName?: string | null;
}): string | null {
  const fromField = formatPropertyUnit(input.unitNumber);
  if (fromField) return fromField;

  const fromName = extractUnitNumberFromText(input.name);
  if (fromName) return fromName;

  if (input.listingName) {
    const fromListing = extractUnitNumberFromText(input.listingName);
    if (fromListing) return fromListing;
  }

  return null;
}

export function formatCalendarUnitDisplay(unit: string | null): string {
  if (!unit) return "—";
  const digits = unit.replace(/\D/g, "");
  return digits || unit;
}
