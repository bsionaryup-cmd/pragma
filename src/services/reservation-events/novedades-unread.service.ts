import "server-only";

import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";
import { getLatestOperationalFeedTimestamp } from "@/services/novedades/operational-feed.service";

export type NovedadesUnreadSnapshot = {
  scopeKey: string;
  latestAt: string | null;
  latestId: string | null;
};

const SNAPSHOT_CACHE_MS = 8_000;
const snapshotCache = new Map<
  string,
  { expiresAt: number; snapshot: NovedadesUnreadSnapshot }
>();

export async function getNovedadesUnreadSnapshot(): Promise<NovedadesUnreadSnapshot> {
  const scope = await requireTenantDataScope();
  const scopeKey = scope.organizationId ?? scope.userId;
  const now = Date.now();
  const cached = snapshotCache.get(scopeKey);
  if (cached && cached.expiresAt > now) {
    return cached.snapshot;
  }

  const latest = await getLatestOperationalFeedTimestamp(scope);
  const snapshot: NovedadesUnreadSnapshot = {
    scopeKey,
    latestAt: latest.latestAt,
    latestId: latest.latestId,
  };

  snapshotCache.set(scopeKey, {
    expiresAt: now + SNAPSHOT_CACHE_MS,
    snapshot,
  });

  return snapshot;
}
