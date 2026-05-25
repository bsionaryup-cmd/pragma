type TTLockPropertyRef = {
  name: string;
  unitNumber?: string | null;
};

export function parsePropertyUnitNumber(unitNumber?: string | null): number | null {
  if (!unitNumber?.trim()) return null;
  const match = unitNumber.trim().match(/\d+/);
  if (!match) return null;
  const value = Number(match[0]);
  return Number.isFinite(value) ? value : null;
}

export function formatTTLockPropertyUnit(property: TTLockPropertyRef): string | null {
  const unit = property.unitNumber?.trim();
  return unit ? `Apto ${unit}` : null;
}

/** Primary label for lock mapping rows — unit number first. */
export function formatTTLockPropertyLabel(property: TTLockPropertyRef): string {
  return formatTTLockPropertyUnit(property) ?? property.name;
}

export function formatTTLockPropertyOption(property: TTLockPropertyRef): string {
  const unit = formatTTLockPropertyUnit(property);
  if (unit) return `${unit} · ${property.name}`;
  return property.name;
}

export function sortTTLockProperties<T extends TTLockPropertyRef>(properties: T[]): T[] {
  return [...properties].sort((a, b) => {
    const unitA = parsePropertyUnitNumber(a.unitNumber);
    const unitB = parsePropertyUnitNumber(b.unitNumber);
    if (unitA != null && unitB != null && unitA !== unitB) return unitA - unitB;
    if (unitA != null && unitB == null) return -1;
    if (unitA == null && unitB != null) return 1;
    return a.name.localeCompare(b.name, "es");
  });
}
