/** PriceLabs Customer API (Open API) — server-only configuration. */

export const PRICELABS_API_BASE = "https://api.pricelabs.co";

/** Official Swagger limits */
export const PRICELABS_RATE_LIMIT_PER_MINUTE = 60;
export const PRICELABS_RATE_LIMIT_PER_HOUR = 1000;

const DEFAULT_TIMEOUT_MS = 300_000;
const DEFAULT_PMS = "other";

export function isPriceLabsLiveApiEnabled(): boolean {
  return process.env.PRICELABS_API_ENABLED === "true";
}

export function getPriceLabsApiBaseUrl(): string {
  const raw = process.env.PRICELABS_BASE_URL?.trim();
  return raw && raw.length > 0 ? raw.replace(/\/$/, "") : PRICELABS_API_BASE;
}

/** Env-only API key (Vercel / .env). Prefer resolvePriceLabsApiKey() for runtime. */
export function getPriceLabsApiKeyFromEnv(): string | null {
  const key =
    process.env.PRICELABS_API_KEY?.trim() ||
    process.env.PRICELABS_TOKEN?.trim();
  return key && key.length > 0 ? key : null;
}

/** @deprecated Use getPriceLabsApiKeyFromEnv or resolvePriceLabsApiKey */
export function getPriceLabsApiKey(): string | null {
  return getPriceLabsApiKeyFromEnv();
}

export function getPriceLabsPmsName(): string {
  return process.env.PRICELABS_PMS_NAME?.trim() || DEFAULT_PMS;
}

export function getPriceLabsRequestTimeoutMs(): number {
  const raw = process.env.PRICELABS_TIMEOUT_MS?.trim();
  if (!raw) return DEFAULT_TIMEOUT_MS;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

export function isPriceLabsApiKeyConfigured(): boolean {
  return Boolean(getPriceLabsApiKeyFromEnv());
}
