/**
 * Etiquetas visuales de propiedad (número de apartamento + nombre).
 */
export function formatPropertyUnit(
  unitNumber?: string | null,
): string | null {
  const trimmed = unitNumber?.trim();
  return trimmed ? trimmed : null;
}

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

/** unitNumber persistido o extracción desde nombre/listing. */
export function resolvePropertyUnit(input: {
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

export function formatPropertyUnitDisplay(unit: string | null): string {
  if (!unit) return "—";
  const digits = unit.replace(/\D/g, "");
  return digits || unit;
}

export function formatPropertyLabel(input: {
  name: string;
  unitNumber?: string | null;
  listingName?: string | null;
}): string {
  const unit = resolvePropertyUnit(input);
  if (unit) return `${formatPropertyUnitDisplay(unit)} — ${input.name}`;
  return input.name;
}

/** Clave numérica para ordenar aptos (801, 802, 803…). */
export function unitNumberSortKey(unitNumber?: string | null): number | null {
  const unit = formatPropertyUnit(unitNumber);
  if (!unit) return null;
  const digits = unit.replace(/\D/g, "");
  if (!digits) return null;
  const parsed = Number.parseInt(digits, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function comparePropertiesByUnitNumber(
  a: { unitNumber?: string | null; name: string },
  b: { unitNumber?: string | null; name: string },
): number {
  const keyA = unitNumberSortKey(a.unitNumber);
  const keyB = unitNumberSortKey(b.unitNumber);
  if (keyA !== null && keyB !== null && keyA !== keyB) return keyA - keyB;
  if (keyA !== null && keyB === null) return -1;
  if (keyA === null && keyB !== null) return 1;
  return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
}

export function sortPropertiesByUnitNumber<T>(
  items: T[],
  pick: (item: T) => { unitNumber?: string | null; name: string },
): T[] {
  return [...items].sort((left, right) =>
    comparePropertiesByUnitNumber(pick(left), pick(right)),
  );
}

export function propertyMatchesQuery(
  property: {
    name: string;
    unitNumber?: string | null;
    address?: string | null;
  },
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const unit = formatPropertyUnit(property.unitNumber)?.toLowerCase() ?? "";
  const address = property.address?.toLowerCase() ?? "";
  return (
    property.name.toLowerCase().includes(q) ||
    unit.includes(q) ||
    address.includes(q)
  );
}
