import { normalizeSiteSlug } from "@/lib/web-builder/reserved-slugs";

const PROTECTED_HOME_SLUGS = new Set(["home", "inicio"]);

/**
 * Páginas de inicio del sitio tenant (no se pueden eliminar de forma permanente).
 */
export function isProtectedHomePageSlug(slug: string): boolean {
  const trimmed = slug.trim();
  if (!trimmed) return true;
  const normalized = normalizeSiteSlug(trimmed);
  if (!normalized) return true;
  return PROTECTED_HOME_SLUGS.has(normalized);
}

export const PROTECTED_HOME_PAGE_DELETE_MESSAGE =
  "No se puede eliminar la página de inicio. Archívala para ocultarla del sitio.";