import {
  getPriceLabsApiKeyFromEnv,
  isPriceLabsLiveApiEnabled,
} from "@/lib/integrations/pricelabs-config";

export type PriceLabsAuthHeaders = {
  "X-API-Key": string;
  "Content-Type": "application/json";
  Accept: "application/json";
};

export class PriceLabsConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PriceLabsConfigError";
  }
}

export function buildPriceLabsHeaders(apiKey: string): PriceLabsAuthHeaders {
  const key = apiKey.trim();
  if (!key) {
    throw new PriceLabsConfigError("API key PriceLabs vacía");
  }
  return {
    "X-API-Key": key,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

export function assertPriceLabsLiveOrThrow(): void {
  if (!isPriceLabsLiveApiEnabled()) {
    throw new PriceLabsConfigError(
      "API PriceLabs en modo simulación. Quita PRICELABS_API_ENABLED=false del servidor para llamadas reales.",
    );
  }
}

export function isPriceLabsConfiguredFromEnv(): boolean {
  return Boolean(getPriceLabsApiKeyFromEnv());
}
