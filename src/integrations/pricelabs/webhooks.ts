/**
 * Future: inbound webhooks from PriceLabs.
 */

export type PriceLabsWebhookEvent = {
  type: string;
  payload: unknown;
};

export function parsePriceLabsWebhook(body: unknown): PriceLabsWebhookEvent | null {
  void body;
  return null;
}
