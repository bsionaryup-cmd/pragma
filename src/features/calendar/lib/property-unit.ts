import { formatPropertyUnit } from "@/lib/property-display";

/** Número de apartamento para sidebar del calendario (unitNumber o extracción del nombre). */
export function resolveCalendarUnitLabel(input: {
  name: string;
  unitNumber?: string | null;
}): string | null {
  const fromField = formatPropertyUnit(input.unitNumber);
  if (fromField) return fromField;

  const name = input.name.trim();
  const aptoMatch = name.match(/(?:apto|apt\.?|unidad)\s*[#.]?\s*(\d{2,4})\b/i);
  if (aptoMatch) return aptoMatch[1];

  const embedded = name.match(/\b(8\d{2}|7\d{2})\b/);
  if (embedded) return embedded[1];

  return null;
}

export function formatCalendarUnitDisplay(unit: string | null): string {
  if (!unit) return "—";
  const digits = unit.replace(/\D/g, "");
  return digits || unit;
}
