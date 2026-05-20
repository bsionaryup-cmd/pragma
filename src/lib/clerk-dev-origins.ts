const DEV_PORT_RANGE = [3000, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009, 3010] as const;

/** Orígenes permitidos para Clerk en desarrollo local (mismo rango que scripts/dev.mjs). */
export function getClerkAllowedDevOrigins(): string[] {
  const origins = new Set<string>();

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

  const devOrigin = process.env.NEXT_PUBLIC_DEV_ORIGIN?.trim();
  if (devOrigin) {
    origins.add(devOrigin);
  }

  return [...origins];
}
