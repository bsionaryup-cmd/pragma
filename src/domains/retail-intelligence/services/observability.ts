import "server-only";

type ObsLevel = "info" | "warn" | "error";

/**
 * Structured Inventory Intelligence diagnostics (stdout → Vercel/host logs).
 * Does not write to PMS tables. Outbox rows remain the durable event source.
 */
export function logIntelObs(
  level: ObsLevel,
  event: string,
  payload: Record<string, unknown> = {},
): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    scope: "retail-intel",
    level,
    event,
    ...payload,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}
