import type { ProspectingLeadType } from "@prisma/client";
import type { LeadIntelligenceInput } from "@/lib/prospecting/prospecting-intelligence";

export type ConversationGuide = {
  likelyPainPoints: string[];
  recommendedFirstQuestion: string;
  recommendedFollowUp: string;
};

const DEFAULT_FIRST_QUESTION =
  "¿Qué parte de la operación les consume más tiempo hoy?";

const PM_TYPES: ProspectingLeadType[] = [
  "PROPERTY_MANAGER",
  "CO_HOST",
  "VACATION_RENTAL_OPERATOR",
];

function categoryHints(category: string | null): string[] {
  const c = (category ?? "").toLowerCase();
  const hints: string[] = [];
  if (/airbnb|rental|vacation|turíst|hosped/.test(c)) {
    hints.push("Coordinación de limpieza entre reservas");
    hints.push("Comunicación con huéspedes en múltiples canales");
  }
  if (/property|gesti|admin|inmobili/.test(c)) {
    hints.push("Visibilidad operativa entre propiedades");
    hints.push("Reportes para propietarios");
  }
  if (/hotel|hostel/.test(c)) {
    hints.push("Check-in y llaves en horarios variables");
    hints.push("Housekeeping y turnos");
  }
  return hints;
}

function followUpByType(leadType: ProspectingLeadType | null, status: string): string {
  if (status === "RESPONDED" || status === "INTERESTED") {
    return "¿Cómo llevan hoy la comunicación con huéspedes y el equipo de limpieza?";
  }
  if (leadType && PM_TYPES.includes(leadType)) {
    return "¿Cuántas propiedades administran y qué herramienta usan para el calendario?";
  }
  if (leadType === "HOST") {
    return "¿Manejan ustedes mismos la limpieza y los mensajes o tienen apoyo?";
  }
  if (leadType === "HOTEL" || leadType === "HOSTEL") {
    return "¿Cómo coordinan check-in y acceso cuando no hay recepción 24h?";
  }
  return "¿Qué proceso les quita más horas cada semana?";
}

/** Rule-based conversation guidance — works without OpenAI. */
export function buildConversationGuide(input: LeadIntelligenceInput): ConversationGuide {
  const painPoints = new Set<string>([
    "Comunicación con huéspedes",
    "Coordinación de limpieza",
    "Sincronización de calendarios OTA",
    "Precios dinámicos y ocupación",
    "Check-in y acceso automatizado",
  ]);

  for (const hint of categoryHints(input.category)) {
    painPoints.add(hint);
  }

  if (input.leadType && PM_TYPES.includes(input.leadType)) {
    painPoints.add("Escala operativa sin perder control");
    painPoints.add("Onboarding de nuevas propiedades");
  }

  if ((input.reviews ?? 0) >= 15) {
    painPoints.add("Volumen de reseñas y reputación online");
  }

  if ((input.listingsCount ?? 0) >= 3) {
    painPoints.add("Gestión de portafolio multi-listing");
  }

  const likelyPainPoints = [...painPoints].slice(0, 5);

  let recommendedFirstQuestion = DEFAULT_FIRST_QUESTION;
  if (input.leadType && PM_TYPES.includes(input.leadType)) {
    recommendedFirstQuestion =
      "Gestionan varias propiedades en renta corta — ¿qué parte de la operación les quita más tiempo hoy?";
  } else if (input.category && /hotel|hostel/i.test(input.category)) {
    recommendedFirstQuestion =
      "¿Cómo manejan hoy check-in, llaves y la coordinación del equipo?";
  }

  return {
    likelyPainPoints,
    recommendedFirstQuestion,
    recommendedFollowUp: followUpByType(input.leadType, input.status),
  };
}
