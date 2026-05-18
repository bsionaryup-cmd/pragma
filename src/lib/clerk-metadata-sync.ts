import type { UserRole } from "@prisma/client";

type MetadataPayload = { role: UserRole; dbUserId: string };

const SYNC_COOLDOWN_MS = 15 * 60 * 1000;
const RATE_LIMIT_BACKOFF_MS = 15 * 60 * 1000;

const lastSuccessfulSync = new Map<string, number>();
const rateLimitedUntil = new Map<string, number>();

function syncKey(clerkId: string, payload: MetadataPayload) {
  return `${clerkId}:${payload.dbUserId}:${payload.role}`;
}

export function shouldSyncClerkPublicMetadata(
  clerkId: string,
  payload: MetadataPayload,
): boolean {
  const now = Date.now();
  const backoff = rateLimitedUntil.get(clerkId);
  if (backoff && now < backoff) return false;

  const key = syncKey(clerkId, payload);
  const last = lastSuccessfulSync.get(key);
  return !last || now - last > SYNC_COOLDOWN_MS;
}

export function markClerkPublicMetadataSynced(
  clerkId: string,
  payload: MetadataPayload,
) {
  lastSuccessfulSync.set(syncKey(clerkId, payload), Date.now());
  rateLimitedUntil.delete(clerkId);
}

export function markClerkPublicMetadataRateLimited(clerkId: string) {
  rateLimitedUntil.set(clerkId, Date.now() + RATE_LIMIT_BACKOFF_MS);
}
