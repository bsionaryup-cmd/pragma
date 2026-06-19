import type { InboxAiPropertyContext } from "@/services/inbox-ai/inbox-context.types";

/**
 * Knowledge Base — estructura preparada para FAQ/manual por propiedad.
 * Fase actual: se materializa desde campos existentes de Property.
 * Fase futura: tabla dedicada PropertyKnowledgeSection.
 */
export type PropertyKnowledgeSectionType =
  | "FAQ"
  | "HOUSE_MANUAL"
  | "RULES"
  | "WIFI"
  | "PARKING"
  | "ACCESS"
  | "CHECKIN"
  | "CHECKOUT"
  | "RECOMMENDATIONS"
  | "INTERNAL_NOTES";

export type PropertyKnowledgeSection = {
  type: PropertyKnowledgeSectionType;
  title: string;
  body: string;
  source: "property_field" | "custom";
};

export type PropertyKnowledgeSnapshot = {
  propertyId: string;
  sections: PropertyKnowledgeSection[];
};

export function buildPropertyKnowledgeFromContext(
  property: InboxAiPropertyContext,
): PropertyKnowledgeSnapshot {
  const sections: PropertyKnowledgeSection[] = [];

  const push = (
    type: PropertyKnowledgeSectionType,
    title: string,
    body: string | null | undefined,
  ) => {
    const trimmed = body?.trim();
    if (!trimmed) return;
    sections.push({ type, title, body: trimmed, source: "property_field" });
  };

  push(
    "WIFI",
    "WiFi",
    [property.wifiName, property.wifiPassword].filter(Boolean).join(" / "),
  );
  push("RULES", "Reglas de la casa", property.houseRules);
  push("ACCESS", "Instrucciones de acceso", property.accessInstructions);
  push("ACCESS", "Código de acceso", property.accessCode);
  push(
    "CHECKIN",
    "Check-in",
    [property.checkInTime ? `Hora: ${property.checkInTime}` : null, property.address]
      .filter(Boolean)
      .join(". "),
  );
  push(
    "CHECKOUT",
    "Check-out",
    property.checkOutTime ? `Hora: ${property.checkOutTime}` : null,
  );

  const locationParts = [
    property.label,
    property.unitNumber ? `Unidad ${property.unitNumber}` : null,
    property.address,
    property.neighborhood,
    property.city,
  ].filter(Boolean);

  push(
    "FAQ",
    "Ubicación del alojamiento",
    locationParts.length > 0 ? locationParts.join(" · ") : null,
  );

  if (property.neighborhood?.trim() || property.city?.trim()) {
    push(
      "RECOMMENDATIONS",
      "Zona / barrio",
      [property.neighborhood, property.city].filter(Boolean).join(", "),
    );
  }

  if (property.receptionWhatsapp?.trim()) {
    push("INTERNAL_NOTES", "Contacto recepción", property.receptionWhatsapp);
  }

  return { propertyId: property.id, sections };
}
