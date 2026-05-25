/** TRAA / TRA PMS (MINCIT Colombia) — server-only configuration. */

export const TRAA_API_DEFAULT_BASE = "https://pms.mincit.gov.co";
export const TRAA_API_DEFAULT_PRIMARY_PATH = "/one/";
export const TRAA_API_DEFAULT_SECONDARY_PATH = "/two/";

const DEFAULT_TIMEOUT_MS = 30_000;

export function getTraaApiBaseUrl(): string {
  const raw = process.env.TRAA_API_BASE_URL?.trim();
  return raw && raw.length > 0 ? raw.replace(/\/$/, "") : TRAA_API_DEFAULT_BASE;
}

export function getTraaPrimaryApiPath(): string {
  const raw = process.env.TRAA_API_PRIMARY_PATH?.trim();
  if (raw && raw.startsWith("/")) return raw;
  return TRAA_API_DEFAULT_PRIMARY_PATH;
}

export function getTraaRequestTimeoutMs(): number {
  const raw = Number(process.env.TRAA_REQUEST_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
}

/** Si true, envía cuerpo de prueba mínimo (puede registrar huésped de prueba en TRA). */
export function isTraaTestPayloadEnabled(): boolean {
  return process.env.TRAA_TEST_SEND_PAYLOAD?.trim().toLowerCase() === "true";
}
