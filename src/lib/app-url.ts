/**
 * URL pública de la app (ngrok, dominio producción, Vercel).
 * Usada para enlaces iCal exportables hacia Airbnb y calendarios externos.
 *
 * Prioridad: APP_URL → NEXT_PUBLIC_APP_URL → VERCEL_URL
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
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  } catch {
    return false;
  }
}

function readEnvAppUrl(): string | undefined {
  return (
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    undefined
  );
}

export function getPublicAppUrl(): string {
  const fromEnv = readEnvAppUrl();
  if (fromEnv && !isLocalhostUrl(fromEnv)) {
    return normalizeBaseUrl(fromEnv);
  }

  const vercelHost = process.env.VERCEL_URL?.trim();
  if (vercelHost) {
    return normalizeBaseUrl(vercelHost);
  }

  throw new Error(
    "Configura NEXT_PUBLIC_APP_URL o APP_URL en .env.local con tu URL pública (ej. ngrok). " +
      "Airbnb no puede importar calendarios desde localhost.",
  );
}
