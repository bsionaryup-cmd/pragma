const DEV_PORT_RANGE = [3000, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009, 3010] as const;

/** Canonical public origins — always allowed even if NEXT_PUBLIC_APP_URL is empty at build. */
const PRODUCTION_ORIGINS = [
  "https://www.pragmapms.com",
  "https://pragmapms.com",
] as const;

/**
 * Orígenes permitidos para redirects de Clerk (local + producción).
 * Si NEXT_PUBLIC_APP_URL falta o está vacío en el build de Vercel, sin los
 * orígenes canónicos Clerk falla en www.pragmapms.com con
 * "This page couldn't load / ERROR &lt;digest&gt;".
 */
export function getClerkAllowedDevOrigins(): string[] {
  const origins = new Set<string>(PRODUCTION_ORIGINS);

  for (const port of DEV_PORT_RANGE) {
    origins.add(`http://localhost:${port}`);
    origins.add(`http://127.0.0.1:${port}`);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) {
    try {
      origins.add(new URL(appUrl).origin);
    } catch {
      // ignore invalid URL
    }
  }

  const appUrlAlt = process.env.APP_URL?.trim();
  if (appUrlAlt) {
    try {
      origins.add(new URL(appUrlAlt).origin);
    } catch {
      // ignore
    }
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    origins.add(
      vercelUrl.startsWith("http") ? new URL(vercelUrl).origin : `https://${vercelUrl}`,
    );
  }

  const devOrigin = process.env.NEXT_PUBLIC_DEV_ORIGIN?.trim();
  if (devOrigin) {
    origins.add(devOrigin);
  }

  return [...origins];
}

/**
 * Parties authorized for session tokens (middleware `azp`).
 * Keep this tight to public app origins — do not dump every localhost port.
 */
export function getClerkAuthorizedParties(): string[] {
  const parties = new Set<string>(PRODUCTION_ORIGINS);
  for (const raw of [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_URL,
  ]) {
    const value = raw?.trim();
    if (!value) continue;
    try {
      parties.add(new URL(value).origin);
    } catch {
      // ignore
    }
  }
  return [...parties];
}
