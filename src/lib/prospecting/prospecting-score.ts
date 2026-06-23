import type { ProspectingFitLevel, ProspectingLeadStatus, ProspectingLeadType } from "@prisma/client";

export type ProspectingPriority = "HOT" | "WARM" | "COLD";

export type ProspectingScoreInput = {
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviews: number | null;
  listingsCount: number | null;
  category: string | null;
  leadType: ProspectingLeadType | null;
  potentialPragmaFit: ProspectingFitLevel | null;
  estimatedSophistication: ProspectingFitLevel | null;
  status: ProspectingLeadStatus;
};

export type ProspectingScoreResult = {
  score: number;
  priority: ProspectingPriority;
  airbnbScore: ProspectingFitLevel | null;
};

const PM_TYPES: ProspectingLeadType[] = [
  "PROPERTY_MANAGER",
  "CO_HOST",
  "VACATION_RENTAL_OPERATOR",
];

const FIT_POINTS: Record<ProspectingFitLevel, number> = {
  HIGH: 22,
  MEDIUM: 12,
  LOW: 4,
};

const CLOSED_STATUSES: ProspectingLeadStatus[] = [
  "CUSTOMER",
  "NOT_INTERESTED",
  "ARCHIVED",
];

function fitPoints(level: ProspectingFitLevel | null): number {
  if (!level) return 0;
  return FIT_POINTS[level];
}

/** Airbnb qualification score from listing signals (not contact data). */
export function computeAirbnbQualificationScore(input: {
  listingsCount: number | null;
  rating: number | null;
  reviews: number | null;
  category: string | null;
}): ProspectingFitLevel | null {
  const listings = input.listingsCount ?? 0;
  const reviews = input.reviews ?? 0;
  const rating = input.rating ?? 0;
  const category = (input.category ?? "").toLowerCase();

  if (listings === 0 && reviews === 0 && rating === 0) return null;

  let points = 0;
  if (listings >= 5) points += 3;
  else if (listings >= 2) points += 2;
  else if (listings >= 1) points += 1;

  if (reviews >= 50) points += 2;
  else if (reviews >= 15) points += 1;

  if (rating >= 4.8) points += 2;
  else if (rating >= 4.5) points += 1;

  if (/superhost|property|gesti|admin|co-?host/.test(category)) points += 1;

  if (points >= 5) return "HIGH";
  if (points >= 3) return "MEDIUM";
  if (points >= 1) return "LOW";
  return null;
}

export function computeProspectingScore(input: ProspectingScoreInput): ProspectingScoreResult {
  if (CLOSED_STATUSES.includes(input.status)) {
    return { score: 0, priority: "COLD", airbnbScore: null };
  }

  let score = 0;

  if (input.phone?.trim()) score += 28;
  if (input.website?.trim()) score += 12;

  score += fitPoints(input.potentialPragmaFit);
  score += Math.round(fitPoints(input.estimatedSophistication) * 0.5);

  if (input.leadType && PM_TYPES.includes(input.leadType)) score += 18;
  else if (input.leadType === "HOTEL" || input.leadType === "HOSTEL") score += 12;

  if ((input.rating ?? 0) >= 4.5) score += 8;
  if ((input.reviews ?? 0) >= 20) score += 8;
  else if ((input.reviews ?? 0) >= 5) score += 4;

  const category = (input.category ?? "").toLowerCase();
  if (/property|gesti|admin|co-?host|inmobili|rental/.test(category)) score += 10;

  const airbnbScore = computeAirbnbQualificationScore({
    listingsCount: input.listingsCount,
    rating: input.rating,
    reviews: input.reviews,
    category: input.category,
  });
  score += fitPoints(airbnbScore);

  if (input.status === "NEW" && input.phone?.trim()) score += 6;
  if (input.status === "INTERESTED" || input.status === "DEMO") score += 10;
  if (input.status === "FOLLOW_UP") score += 5;

  const clamped = Math.min(100, Math.max(0, score));
  const priority: ProspectingPriority =
    clamped >= 68 ? "HOT" : clamped >= 38 ? "WARM" : "COLD";

  return { score: clamped, priority, airbnbScore };
}

export const PRIORITY_LABELS: Record<ProspectingPriority, string> = {
  HOT: "Prioridad alta",
  WARM: "Prioridad media",
  COLD: "Prioridad baja",
};

export const PRIORITY_BADGE_CLASS: Record<ProspectingPriority, string> = {
  HOT: "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  WARM: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200",
  COLD: "border-border bg-muted/50 text-muted-foreground",
};
