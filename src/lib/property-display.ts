/**
 * Etiquetas visuales de propiedad (número de apartamento + nombre).
 */
export function formatPropertyUnit(
  unitNumber?: string | null,
): string | null {
  const trimmed = unitNumber?.trim();
  return trimmed ? trimmed : null;
}

export function formatPropertyLabel(input: {
  name: string;
  unitNumber?: string | null;
}): string {
  const unit = formatPropertyUnit(input.unitNumber);
  if (unit) return `${unit} — ${input.name}`;
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
