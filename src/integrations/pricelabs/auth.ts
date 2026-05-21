import {
  getPriceLabsIntegrationName,
  getPriceLabsIntegrationToken,
  getPriceLabsUserTokenFromEnv,
  isPriceLabsLiveApiEnabled,
} from "@/lib/integrations/pricelabs-config";

export type PriceLabsAuthHeaders = {
  "X-INTEGRATION-TOKEN": string;
  "X-INTEGRATION-NAME": string;
  user_token: string;
  "Content-Type": "application/json";
};

export type PriceLabsAuthConfig = {
  integrationToken: string;
  integrationName: string;
  userToken: string;
};

export class PriceLabsConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PriceLabsConfigError";
  }
}

export function validatePriceLabsEnv(): PriceLabsAuthConfig {
  const integrationToken = getPriceLabsIntegrationToken();
  const userToken = getPriceLabsUserTokenFromEnv();

  if (!integrationToken) {
    throw new PriceLabsConfigError(
      "Falta PRICELABS_TOKEN en variables de entorno",
    );
  }
  if (!userToken) {
    throw new PriceLabsConfigError(
      "Falta PRICELABS_USER_TOKEN en variables de entorno",
    );
  }

  return {
    integrationToken,
    integrationName: getPriceLabsIntegrationName(),
    userToken,
  };
}

export function buildPriceLabsHeaders(
  config: PriceLabsAuthConfig,
): PriceLabsAuthHeaders {
  return {
    "X-INTEGRATION-TOKEN": config.integrationToken,
    "X-INTEGRATION-NAME": config.integrationName,
    user_token: config.userToken,
    "Content-Type": "application/json",
  };
}

export function resolvePriceLabsAuth(input?: {
  userTokenOverride?: string | null;
}): PriceLabsAuthConfig {
  const base = validatePriceLabsEnv();
  const override = input?.userTokenOverride?.trim();
  if (override) {
    return { ...base, userToken: override };
  }
  return base;
}

export function assertPriceLabsLiveOrThrow(): void {
  if (!isPriceLabsLiveApiEnabled()) {
    throw new PriceLabsConfigError(
      "API PriceLabs deshabilitada. Define PRICELABS_API_ENABLED=true para llamadas live.",
    );
  }
}

export function isPriceLabsConfigured(): boolean {
  try {
    validatePriceLabsEnv();
    return true;
  } catch {
    return false;
  }
}
