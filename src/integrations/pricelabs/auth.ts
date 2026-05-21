import {
  getPriceLabsApiKey,
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

export function buildPriceLabsHeaders(apiKey?: string): PriceLabsAuthHeaders {
  const key = apiKey ?? getPriceLabsApiKey();
  if (!key) {
    throw new PriceLabsConfigError(
      "Falta PRICELABS_API_KEY en variables de entorno del servidor",
    );
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
      "API PriceLabs deshabilitada. Define PRICELABS_API_ENABLED=true para llamadas live.",
    );
  }
}

export function isPriceLabsConfiguredFromEnv(): boolean {
  return Boolean(getPriceLabsApiKey());
}
