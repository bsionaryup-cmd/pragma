import type { ProspectingFitLevel, ProspectingLeadStatus, ProspectingLeadType } from "@prisma/client";
import type { ProspectingPriority } from "@/lib/prospecting/prospecting-score";

export type FollowUpUrgency = "OVERDUE" | "TODAY" | "TOMORROW" | "THIS_WEEK";

export type LeadIntelligenceInput = {
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviews: number | null;
  listingsCount: number | null;
  category: string | null;
  leadType: ProspectingLeadType | null;
  potentialPragmaFit: ProspectingFitLevel | null;
  estimatedSophistication: ProspectingFitLevel | null;
  airbnbScore: ProspectingFitLevel | null;
  status: ProspectingLeadStatus;
  priority: ProspectingPriority;
  outreachMessage: string | null;
  nextFollowUpDate: string | null;
};

const PM_TYPES: ProspectingLeadType[] = [
  "PROPERTY_MANAGER",
  "CO_HOST",
  "VACATION_RENTAL_OPERATOR",
];

const CLOSED_STATUSES: ProspectingLeadStatus[] = [
  "CUSTOMER",
  "NOT_INTERESTED",
  "ARCHIVED",
];

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getFollowUpUrgency(
  nextFollowUpDate: string | null,
  now = new Date(),
): FollowUpUrgency | null {
  if (!nextFollowUpDate) return null;

  const target = startOfDay(new Date(nextFollowUpDate));
  const today = startOfDay(now);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000);

  if (diffDays < 0) return "OVERDUE";
  if (diffDays === 0) return "TODAY";
  if (diffDays === 1) return "TOMORROW";
  if (diffDays <= 7) return "THIS_WEEK";
  return null;
}

export const FOLLOW_UP_URGENCY_LABELS: Record<FollowUpUrgency, string> = {
  OVERDUE: "Vencido",
  TODAY: "Hoy",
  TOMORROW: "Mañana",
  THIS_WEEK: "Esta semana",
};

export const FOLLOW_UP_URGENCY_CLASS: Record<FollowUpUrgency, string> = {
  OVERDUE: "border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-300",
  TODAY: "border-orange-500/50 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  TOMORROW: "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200",
  THIS_WEEK: "border-border bg-muted/50 text-muted-foreground",
};

/** Human-readable reasons visible on cards — max 4, prioritized. */
export function buildLeadScoreReasons(input: LeadIntelligenceInput): string[] {
  if (CLOSED_STATUSES.includes(input.status)) {
    return ["Lead cerrado en pipeline"];
  }

  const reasons: string[] = [];
  const urgency = getFollowUpUrgency(input.nextFollowUpDate);
  if (urgency === "OVERDUE") reasons.push("Seguimiento vencido");
  else if (urgency === "TODAY") reasons.push("Seguimiento hoy");

  if (input.status === "NEW" && input.phone?.trim()) reasons.push("Sin contactar · teléfono listo");
  if (input.phone?.trim()) reasons.push("Teléfono disponible");
  if (input.website?.trim()) reasons.push("Sitio web disponible");

  if (input.leadType && PM_TYPES.includes(input.leadType)) {
    reasons.push("Perfil property manager / co-host");
  } else if (input.category && /property|gesti|admin|co-?host|inmobili/i.test(input.category)) {
    reasons.push("Categoría de gestión inmobiliaria");
  }

  if ((input.reviews ?? 0) >= 20) reasons.push("Alto volumen de reseñas");
  else if ((input.reviews ?? 0) >= 5) reasons.push("Reseñas verificables");

  if ((input.rating ?? 0) >= 4.5) reasons.push("Rating sólido en Google");

  if (input.potentialPragmaFit === "HIGH") reasons.push("Fit PRAGMA alto (IA)");
  else if (input.potentialPragmaFit === "MEDIUM") reasons.push("Fit PRAGMA medio (IA)");

  if (input.airbnbScore === "HIGH") reasons.push("Portafolio Airbnb fuerte");
  else if (input.airbnbScore === "MEDIUM") reasons.push("Señal Airbnb moderada");

  if (input.outreachMessage?.trim() && input.status === "NEW") {
    reasons.push("Mensaje de contacto listo");
  }

  if (input.priority === "HOT" && !reasons.some((r) => r.includes("HOT"))) {
    reasons.push("Prioridad HOT por señales combinadas");
  }

  const unique = [...new Set(reasons)];
  return unique.slice(0, 4);
}

export function isContactableStatus(status: ProspectingLeadStatus): boolean {
  return !CLOSED_STATUSES.includes(status);
}

/** Higher = contact sooner. Used for CONTACT NEXT queue. */
export function rankContactNext(input: LeadIntelligenceInput & { prospectingScore: number }): number {
  if (!isContactableStatus(input.status) || !input.phone?.trim()) return -1;

  let rank = input.prospectingScore;
  const urgency = getFollowUpUrgency(input.nextFollowUpDate);

  if (urgency === "OVERDUE") rank += 80;
  else if (urgency === "TODAY") rank += 60;
  else if (urgency === "TOMORROW") rank += 35;
  else if (urgency === "THIS_WEEK") rank += 15;

  if (input.status === "NEW") rank += 25;
  if (input.priority === "HOT") rank += 20;
  if (input.outreachMessage?.trim()) rank += 8;
  if (input.status === "INTERESTED" || input.status === "DEMO") rank += 12;

  return rank;
}
