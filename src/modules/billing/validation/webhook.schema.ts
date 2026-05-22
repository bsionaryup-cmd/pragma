import type { WompiWebhookEvent } from "@/modules/billing/domain/types";

export function parseWompiWebhookPayload(rawBody: string): WompiWebhookEvent | null {
  try {
    const parsed = JSON.parse(rawBody) as WompiWebhookEvent;
    if (typeof parsed !== "object" || parsed === null) return null;
    if (typeof parsed.event !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}
