/**
 * Knowledge provider contract — PMS is the first provider, not the owner of behavior.
 */

export type KnowledgeQuery = {
  organizationId: string;
  assistantId?: string | null;
  intent?: string;
  query: string;
  propertyId?: string | null;
  limit?: number;
};

export type KnowledgeHit = {
  providerKey: string;
  title: string;
  body: string;
  score: number;
  source: "faq" | "property" | "tool" | "doc";
};

export interface KnowledgeProvider {
  readonly key: string;
  readonly displayName: string;
  readonly capabilities: string[];
  search(input: KnowledgeQuery): Promise<KnowledgeHit[]>;
}

export const PRAGMA_PMS_PROVIDER_META = {
  key: "pragma-pms",
  displayName: "PRAGMA PMS",
  description:
    "Alojamientos, reservas, disponibilidad, wifi, pagos y herramientas de hospitalidad.",
  capabilities: [
    "search_availability",
    "create_direct_reservation",
    "get_property_guest_info",
    "search_reservations",
    "faq_articles",
  ],
} as const;
