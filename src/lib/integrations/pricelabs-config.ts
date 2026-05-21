/** PriceLabs Integration API — env and feature flags. */

const DEFAULT_BASE_URL =
  "https://api.pricelabs.co/v1/integration/api";

const DEFAULT_INTEGRATION_NAME = "PRAGMA";

const DEFAULT_TIMEOUT_MS = 300_000;

/** PriceLabs documents ~300 requests/minute. */
export const PRICELABS_RATE_LIMIT_PER_MINUTE = 300;

export function isPriceLabsLiveApiEnabled(): boolean {
  return process.env.PRICELABS_API_ENABLED === "true";
}

export function getPriceLabsBaseUrl(): string {
  const raw = process.env.PRICELABS_BASE_URL?.trim();
  return raw && raw.length > 0 ? raw.replace(/\/$/, "") : DEFAULT_BASE_URL;
}

export function getPriceLabsIntegrationName(): string {
  return (
    process.env.PRICELABS_NAME?.trim() || DEFAULT_INTEGRATION_NAME
  );
}

export function getPriceLabsIntegrationToken(): string | null {
  const token = process.env.PRICELABS_TOKEN?.trim();
  return token && token.length > 0 ? token : null;
}

export function getPriceLabsUserTokenFromEnv(): string | null {
  const token = process.env.PRICELABS_USER_TOKEN?.trim();
  return token && token.length > 0 ? token : null;
}

export function getPriceLabsRequestTimeoutMs(): number {
  const raw = process.env.PRICELABS_TIMEOUT_MS?.trim();
  if (!raw) return DEFAULT_TIMEOUT_MS;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

export type PriceLabsConfigSnapshot = {
  liveApiEnabled: boolean;
  baseUrl: string;
  integrationName: string;
  hasIntegrationToken: boolean;
  hasUserToken: boolean;
  timeoutMs: number;
};

export function getPriceLabsConfigSnapshot(): PriceLabsConfigSnapshot {
  return {
    liveApiEnabled: isPriceLabsLiveApiEnabled(),
    baseUrl: getPriceLabsBaseUrl(),
    integrationName: getPriceLabsIntegrationName(),
    hasIntegrationToken: Boolean(getPriceLabsIntegrationToken()),
    hasUserToken: Boolean(getPriceLabsUserTokenFromEnv()),
    timeoutMs: getPriceLabsRequestTimeoutMs(),
  };
}
