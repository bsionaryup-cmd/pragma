import { priceLabsRequest } from "@/integrations/pricelabs/client";
import type {
  PriceLabsResult,
  PriceLabsStatusResponse,
} from "@/integrations/pricelabs/types";

export async function fetchPriceLabsStatus(input?: {
  userTokenOverride?: string | null;
}): Promise<PriceLabsResult<PriceLabsStatusResponse>> {
  return priceLabsRequest<PriceLabsStatusResponse>("/status", {
    method: "GET",
    userTokenOverride: input?.userTokenOverride,
    retryable: true,
  });
}

export function normalizeStatusHealth(
  data: PriceLabsStatusResponse,
): { healthy: boolean; label: string } {
  if (typeof data.healthy === "boolean") {
    return {
      healthy: data.healthy,
      label: data.healthy ? "Saludable" : "Degradado",
    };
  }
  const status = (data.status ?? "").toLowerCase();
  const healthy =
    data.success === true ||
    status === "ok" ||
    status === "healthy" ||
    status === "connected";
  return {
    healthy,
    label: healthy ? "Saludable" : status || "Desconocido",
  };
}
