export const LEGAL_DOCUMENT_VERSION = "2026-05-28";

export type LegalDocumentSlug =
  | "terminos"
  | "privacidad"
  | "tratamiento-datos"
  | "cookies"
  | "suscripcion-saas";

export type LegalDocumentMeta = {
  slug: LegalDocumentSlug;
  title: string;
  version: string;
  description: string;
};

export const LEGAL_DOCUMENTS: Record<LegalDocumentSlug, LegalDocumentMeta> = {
  terminos: {
    slug: "terminos",
    title: "Términos y Condiciones",
    version: LEGAL_DOCUMENT_VERSION,
    description: "Uso del software, pagos, cancelación y responsabilidades.",
  },
  privacidad: {
    slug: "privacidad",
    title: "Política de Privacidad",
    version: LEGAL_DOCUMENT_VERSION,
    description: "Qué datos recopilamos, cómo los usamos y cómo los protegemos.",
  },
  "tratamiento-datos": {
    slug: "tratamiento-datos",
    title: "Política de Tratamiento de Datos",
    version: LEGAL_DOCUMENT_VERSION,
    description: "Tratamiento de datos personales conforme a la Ley 1581 de 2012 (Colombia).",
  },
  cookies: {
    slug: "cookies",
    title: "Política de Cookies",
    version: LEGAL_DOCUMENT_VERSION,
    description: "Uso de cookies y tecnologías similares en PRAGMA.",
  },
  "suscripcion-saas": {
    slug: "suscripcion-saas",
    title: "Acuerdo de Suscripción SaaS",
    version: LEGAL_DOCUMENT_VERSION,
    description: "Licencia de uso, propiedad intelectual, soporte y disponibilidad.",
  },
};

export const SIGNUP_LEGAL_DOCUMENT_TYPES = ["terms", "privacy"] as const;

export function legalDocumentHref(slug: LegalDocumentSlug): string {
  return `/legal/${slug}`;
}
