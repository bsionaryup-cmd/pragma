import type { ProspectStatus } from "@/features/sales-console/types/prospect";

/** Editable outreach starters keyed by pipeline stage — used before AI enrichment. */
export const STAGE_OUTREACH_TEMPLATES: Record<ProspectStatus, string> = {
  NEW: `Hola {{empresa}}, soy de PRAGMA. Ayudamos a operadores de alquiler temporal a centralizar reservas, registro de huéspedes y acceso inteligente. ¿Tienes 10 minutos esta semana para una llamada breve?`,
  CONTACTED: `Hola {{empresa}}, te escribo de nuevo desde PRAGMA. ¿Pudiste revisar cómo automatizamos la operación diaria de apartamentos? Quedo atento.`,
  QUALIFIED: `Hola {{empresa}}, gracias por el interés. ¿Te parece si agendamos una demo de 20 minutos para ver calendario, finanzas y códigos de acceso en acción?`,
  DEMO_BOOKED: `Hola {{empresa}}, confirmo nuestra demo PRAGMA. Prepararé ejemplos de tu operación. ¿Hay algo específico que quieras revisar?`,
  PROPOSAL: `Hola {{empresa}}, te comparto la propuesta PRAGMA. ¿Qué dudas tienes sobre implementación, capacitación o inversión?`,
  CUSTOMER: `Hola {{empresa}}, ¿cómo va la operación con PRAGMA? Cuéntame si necesitas apoyo con algún módulo.`,
  LOST: `Hola {{empresa}}, retomo contacto desde PRAGMA por si retomaron planes de profesionalizar la operación. Sin compromiso.`,
};

export function resolveStageOutreachTemplate(
  status: ProspectStatus,
  companyName: string,
): string {
  const raw = STAGE_OUTREACH_TEMPLATES[status] ?? STAGE_OUTREACH_TEMPLATES.NEW;
  return raw.replace(/\{\{empresa\}\}/g, companyName.trim() || "equipo");
}
