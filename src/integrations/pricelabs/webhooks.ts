/**
 * Future: inbound webhooks from PriceLabs.
 */

export type PriceLabsWebhookEvent = {
  type: string;
  payload: unknown;
};

export function parsePriceLabsWebhook(
  _body: unknown,
): PriceLabsWebhookEvent | null {
  return null;
}
