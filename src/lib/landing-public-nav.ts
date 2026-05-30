import {
  LEGAL_DOCUMENTS,
  legalDocumentHref,
  type LegalDocumentSlug,
} from "@/lib/legal/documents";

/** Section ids on the marketing home (`/`). */
export type LandingHomeSection =
  | "solution"
  | "product"
  | "integrations"
  | "pricing"
  | "contact";

/**
 * Hrefs for public marketing nav/footer.
 * On `/` uses in-page anchors; on `/pricing`, `/contact`, etc. uses `/#section` or dedicated routes.
 */
export function landingHomeSectionHref(
  pathname: string,
  section: LandingHomeSection,
): string {
  if (section === "pricing") {
    return pathname === "/" ? "#pricing" : "/pricing";
  }
  if (section === "contact") {
    return pathname === "/" ? "#contact" : "/contact";
  }
  return pathname === "/" ? `#${section}` : `/#${section}`;
}

export const LANDING_NAV_ITEMS: Array<{
  section: LandingHomeSection;
  label: string;
}> = [
  { section: "solution", label: "Solución" },
  { section: "product", label: "Producto" },
  { section: "pricing", label: "Precios" },
  { section: "contact", label: "Contacto" },
];

export const LANDING_FOOTER_ITEMS: Array<{
  section: LandingHomeSection;
  label: string;
}> = [
  { section: "solution", label: "Solución" },
  { section: "product", label: "Producto" },
  { section: "integrations", label: "Integraciones" },
  { section: "pricing", label: "Precios" },
  { section: "contact", label: "Contacto" },
];

export const LANDING_LEGAL_FOOTER_ITEMS: Array<{
  slug: LegalDocumentSlug;
  label: string;
  href: string;
}> = (
  [
    { slug: "terminos" as const, label: LEGAL_DOCUMENTS.terminos.title },
    { slug: "privacidad" as const, label: LEGAL_DOCUMENTS.privacidad.title },
    { slug: "tratamiento-datos" as const, label: "Tratamiento de datos" },
    { slug: "cookies" as const, label: LEGAL_DOCUMENTS.cookies.title },
    { slug: "suscripcion-saas" as const, label: "Suscripción SaaS" },
  ] as const
).map((item) => ({
  ...item,
  href: legalDocumentHref(item.slug),
}));

export function isInPageAnchorHref(href: string): boolean {
  return href.startsWith("#") || href.startsWith("/#");
}
