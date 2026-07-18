export const guestDocumentTypes = [
  "CC",
  "CE",
  "RC",
  "TI",
  "PASSPORT",
  "DNI",
  "DL",
] as const;

export type GuestDocumentType = (typeof guestDocumentTypes)[number];

export const guestDocumentTypeLabels: Record<GuestDocumentType, string> = {
  CC: "Cédula de ciudadanía",
  CE: "Cédula de extranjería",
  RC: "Registro civil",
  TI: "Tarjeta de identidad",
  PASSPORT: "Pasaporte",
  DNI: "DNI",
  DL: "Licencia de conducir",
};

/** Etiquetas de tipos históricos aún presentes en BD. */
export const legacyGuestDocumentTypeLabels: Record<string, string> = {
  OTHER: "Otro",
};

export function getGuestDocumentTypeLabel(type: string): string {
  return (
    guestDocumentTypeLabels[type as GuestDocumentType] ??
    legacyGuestDocumentTypeLabels[type] ??
    type
  );
}
