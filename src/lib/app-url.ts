/**
 * URL pública de la app (ngrok, dominio producción, Vercel).
 * Usada para enlaces iCal exportables hacia Airbnb y calendarios externos.
 *
 * Prioridad: NEXT_PUBLIC_APP_URL pública → APP_URL pública → VERCEL_URL (https)
 * Nunca devuelve localhost (Airbnb no puede leerlo).
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
    return false;
  }
}

export function getPublicAppUrl(): string {
  const candidates: Array<{ value: string; forceHttps?: boolean }> = [];

  const nextPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (nextPublicAppUrl) {
    candidates.push({ value: nextPublicAppUrl });
  }

  const appUrl = process.env.APP_URL?.trim();
  if (appUrl) {
    candidates.push({ value: appUrl });
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    candidates.push({ value: vercelUrl, forceHttps: true });
  }

  for (const candidate of candidates) {
    let normalized = normalizeBaseUrl(candidate.value);
    if (candidate.forceHttps) {
      normalized = normalized.replace(/^http:\/\//i, "https://");
    }
    if (!isLocalhostUrl(normalized)) {
      return normalized;
    }
  }

  throw new Error(
    "Configura NEXT_PUBLIC_APP_URL o APP_URL en .env.local con tu URL pública (ej. ngrok). " +
      "Airbnb no puede importar calendarios desde localhost.",
  );
}
