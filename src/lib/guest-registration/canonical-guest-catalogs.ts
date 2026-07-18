/**
 * Canonical guest catalogs — integration-agnostic.
 * SIRE/TRA/emails map FROM these codes; the form never owns integration shape.
 */

export const GUEST_SEX_CODES = ["M", "F", "X"] as const;
export type GuestSexCode = (typeof GUEST_SEX_CODES)[number];

export const guestSexLabels: Record<GuestSexCode, string> = {
  M: "Masculino",
  F: "Femenino",
  X: "Otro / no binario",
};

/** Principal travel motives aligned with tourism statistics practice (TRA). */
export const GUEST_TRAVEL_MOTIVE_CODES = [
  "LEISURE",
  "BUSINESS",
  "HEALTH",
  "EVENTS",
  "EDUCATION",
  "FAMILY",
  "OTHER",
] as const;
export type GuestTravelMotiveCode = (typeof GUEST_TRAVEL_MOTIVE_CODES)[number];

export const guestTravelMotiveLabels: Record<GuestTravelMotiveCode, string> = {
  LEISURE: "Ocio / vacaciones",
  BUSINESS: "Negocios / trabajo",
  HEALTH: "Salud",
  EVENTS: "Eventos / convenciones",
  EDUCATION: "Educación",
  FAMILY: "Visita familiar",
  OTHER: "Otro",
};

export type IsoCountry = {
  iso: string;
  name: string;
  flag: string;
};

/** Tourism-oriented ISO catalog (CO first). Enough for nationality/residence/origin/destination. */
export const ISO_COUNTRIES: IsoCountry[] = [
  { iso: "CO", name: "Colombia", flag: "🇨🇴" },
  { iso: "US", name: "Estados Unidos", flag: "🇺🇸" },
  { iso: "MX", name: "México", flag: "🇲🇽" },
  { iso: "AR", name: "Argentina", flag: "🇦🇷" },
  { iso: "BR", name: "Brasil", flag: "🇧🇷" },
  { iso: "CL", name: "Chile", flag: "🇨🇱" },
  { iso: "PE", name: "Perú", flag: "🇵🇪" },
  { iso: "EC", name: "Ecuador", flag: "🇪🇨" },
  { iso: "VE", name: "Venezuela", flag: "🇻🇪" },
  { iso: "BO", name: "Bolivia", flag: "🇧🇴" },
  { iso: "PY", name: "Paraguay", flag: "🇵🇾" },
  { iso: "UY", name: "Uruguay", flag: "🇺🇾" },
  { iso: "PA", name: "Panamá", flag: "🇵🇦" },
  { iso: "CR", name: "Costa Rica", flag: "🇨🇷" },
  { iso: "GT", name: "Guatemala", flag: "🇬🇹" },
  { iso: "HN", name: "Honduras", flag: "🇭🇳" },
  { iso: "NI", name: "Nicaragua", flag: "🇳🇮" },
  { iso: "SV", name: "El Salvador", flag: "🇸🇻" },
  { iso: "DO", name: "República Dominicana", flag: "🇩🇴" },
  { iso: "PR", name: "Puerto Rico", flag: "🇵🇷" },
  { iso: "CU", name: "Cuba", flag: "🇨🇺" },
  { iso: "ES", name: "España", flag: "🇪🇸" },
  { iso: "FR", name: "Francia", flag: "🇫🇷" },
  { iso: "DE", name: "Alemania", flag: "🇩🇪" },
  { iso: "IT", name: "Italia", flag: "🇮🇹" },
  { iso: "GB", name: "Reino Unido", flag: "🇬🇧" },
  { iso: "PT", name: "Portugal", flag: "🇵🇹" },
  { iso: "NL", name: "Países Bajos", flag: "🇳🇱" },
  { iso: "BE", name: "Bélgica", flag: "🇧🇪" },
  { iso: "CH", name: "Suiza", flag: "🇨🇭" },
  { iso: "AT", name: "Austria", flag: "🇦🇹" },
  { iso: "SE", name: "Suecia", flag: "🇸🇪" },
  { iso: "NO", name: "Noruega", flag: "🇳🇴" },
  { iso: "DK", name: "Dinamarca", flag: "🇩🇰" },
  { iso: "IE", name: "Irlanda", flag: "🇮🇪" },
  { iso: "PL", name: "Polonia", flag: "🇵🇱" },
  { iso: "CZ", name: "Chequia", flag: "🇨🇿" },
  { iso: "CA", name: "Canadá", flag: "🇨🇦" },
  { iso: "AU", name: "Australia", flag: "🇦🇺" },
  { iso: "NZ", name: "Nueva Zelanda", flag: "🇳🇿" },
  { iso: "IL", name: "Israel", flag: "🇮🇱" },
  { iso: "TR", name: "Turquía", flag: "🇹🇷" },
  { iso: "AE", name: "Emiratos Árabes Unidos", flag: "🇦🇪" },
  { iso: "SA", name: "Arabia Saudita", flag: "🇸🇦" },
  { iso: "CN", name: "China", flag: "🇨🇳" },
  { iso: "JP", name: "Japón", flag: "🇯🇵" },
  { iso: "KR", name: "Corea del Sur", flag: "🇰🇷" },
  { iso: "IN", name: "India", flag: "🇮🇳" },
  { iso: "RU", name: "Rusia", flag: "🇷🇺" },
  { iso: "ZA", name: "Sudáfrica", flag: "🇿🇦" },
  { iso: "NG", name: "Nigeria", flag: "🇳🇬" },
  { iso: "EG", name: "Egipto", flag: "🇪🇬" },
  { iso: "MA", name: "Marruecos", flag: "🇲🇦" },
  { iso: "PH", name: "Filipinas", flag: "🇵🇭" },
  { iso: "TH", name: "Tailandia", flag: "🇹🇭" },
  { iso: "SG", name: "Singapur", flag: "🇸🇬" },
  { iso: "MY", name: "Malasia", flag: "🇲🇾" },
  { iso: "ID", name: "Indonesia", flag: "🇮🇩" },
  { iso: "OTHER", name: "Otro país", flag: "🌐" },
];

/** Departamentos + Distrito Capital (Colombia) — cascada país→depto; ciudad texto libre. */
export const COLOMBIA_ADMIN_AREAS = [
  "Amazonas",
  "Antioquia",
  "Arauca",
  "Atlántico",
  "Bogotá, D.C.",
  "Bolívar",
  "Boyacá",
  "Caldas",
  "Caquetá",
  "Casanare",
  "Cauca",
  "Cesar",
  "Chocó",
  "Córdoba",
  "Cundinamarca",
  "Guainía",
  "Guaviare",
  "Huila",
  "La Guajira",
  "Magdalena",
  "Meta",
  "Nariño",
  "Norte de Santander",
  "Putumayo",
  "Quindío",
  "Risaralda",
  "San Andrés y Providencia",
  "Santander",
  "Sucre",
  "Tolima",
  "Valle del Cauca",
  "Vaupés",
  "Vichada",
] as const;

export function getIsoCountryLabel(iso: string | null | undefined): string {
  if (!iso) return "";
  return ISO_COUNTRIES.find((c) => c.iso === iso)?.name ?? iso;
}

export function isIsoCountryCode(value: string): boolean {
  return ISO_COUNTRIES.some((c) => c.iso === value);
}
