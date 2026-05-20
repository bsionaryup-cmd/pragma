export const PRAGMA_PRODUCTION_APP_URL = "https://pragma-pms.vercel.app";

/**
 * URL pública canónica de la app para iCal exportable.
 *
 * Prioridad: NEXT_PUBLIC_APP_URL válida → APP_URL válida → Vercel producción.
 * Nunca devuelve localhost ni dominios temporales: los calendarios externos deben
 * seguir apuntando al host estable de producción.
 */
function normalizeBaseUrl(url: string): string {
  const trimmed = url.trim().replace(/\/$/, "");
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

function isLocalhostUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return true;
  }
}

function isTemporaryTunnelUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    const blockedHostPart = ["ng", "rok"].join("");
    return host.includes(blockedHostPart);
  } catch {
    return true;
  }
}

function isAllowedPublicAppUrl(url: string): boolean {
  return (
    url === PRAGMA_PRODUCTION_APP_URL &&
    !isLocalhostUrl(url) &&
    !isTemporaryTunnelUrl(url)
  );
}

export function getPublicAppUrl(): string {
  const candidates: string[] = [];
  const nextPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (nextPublicAppUrl) {
    candidates.push(nextPublicAppUrl);
  }

  const appUrl = process.env.APP_URL?.trim();
  if (appUrl) {
    candidates.push(appUrl);
  }
  candidates.push(PRAGMA_PRODUCTION_APP_URL);

  for (const candidate of candidates) {
    const normalized = normalizeBaseUrl(candidate).replace(
      /^http:\/\//i,
      "https://",
    );
    if (isAllowedPublicAppUrl(normalized)) {
      return normalized;
    }
  }

  return PRAGMA_PRODUCTION_APP_URL;
}
