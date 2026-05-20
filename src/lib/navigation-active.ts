/**
 * Determina si una ruta de navegación está activa sin falsos positivos
 * (p. ej. /properties no coincide con /properties-admin).
 */
export function isNavPathActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
