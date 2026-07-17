/**
 * Contexto grounded. Solo hechos proporcionados o resultados de tools.
 * Fase 5: el caller inyecta facts; no hay Prisma aquí.
 */
export type ConciergeContextSnapshot = {
  organizationId: string;
  propertyId?: string | null;
  reservationId?: string | null;
  knownFacts: Record<string, string | number | boolean | null>;
  missingFacts: string[];
  /** Memoria reciente (textos), no prompt completo. */
  recentGuestMessages: string[];
  builtAt: string;
};
