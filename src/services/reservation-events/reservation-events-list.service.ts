import "server-only";

import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";
import { listOperationalFeedForTenant } from "@/services/novedades/operational-feed.service";
import type { OperationalFeedCard } from "@/services/novedades/operational-feed.types";

export type {
  OperationalFeedCard,
  OperationalFeedKind,
} from "@/services/novedades/operational-feed.types";

/** @deprecated Usar listOperationalFeedForTenant */
export type ReservationEventFeedRow = OperationalFeedCard;

export async function listNovedadesForTenant(limit = 60): Promise<OperationalFeedCard[]> {
  const scope = await requireTenantDataScope();
  return listOperationalFeedForTenant(scope, limit);
}
