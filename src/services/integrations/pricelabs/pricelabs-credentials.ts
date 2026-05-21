import { isPriceLabsApiKeyConfigured } from "@/lib/integrations/pricelabs-config";

export type PriceLabsCredentialSnapshot = {
  configured: boolean;
  apiKeyFromEnv: boolean;
};

export async function getPriceLabsCredentialSnapshot(): Promise<PriceLabsCredentialSnapshot> {
  const apiKeyFromEnv = isPriceLabsApiKeyConfigured();
  return {
    configured: apiKeyFromEnv,
    apiKeyFromEnv,
  };
}

export async function isPriceLabsConfiguredAsync(): Promise<boolean> {
  return isPriceLabsApiKeyConfigured();
}
