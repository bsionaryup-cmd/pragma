export type EpaycoEnvironment = "test" | "production";

export const EPAYCO_CHECKOUT_SCRIPT_URL = "https://checkout.epayco.co/checkout.js";

export function resolveEpaycoApifyBaseUrl(env: EpaycoEnvironment): string {
  return env === "production"
    ? "https://apify.epayco.co"
    : "https://apify.epayco.co";
}

export function isEpaycoTestMode(env: EpaycoEnvironment): boolean {
  return env !== "production";
}
