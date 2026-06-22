import type { ProspectEnrichmentContent } from "@/modules/sales-console/enrichment/enrichment.types";

export function formatEnrichmentNotes(content: ProspectEnrichmentContent): string {
  const sections: Array<[string, string]> = [
    ["BRIEF", content.brief],
    ["WHATSAPP", content.whatsapp],
    ["EMAIL", content.email],
    ["PITCH TELEFÓNICO", content.phonePitch],
    ["OBJECIONES COMUNES", content.objections],
    ["CTA RECOMENDADO", content.cta],
  ];

  return sections
    .map(([heading, body]) => `${heading}\n${body.trim()}`)
    .join("\n\n");
}
