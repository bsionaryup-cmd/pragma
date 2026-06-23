const SEARCH_WINDOW_MS = 60_000;
const SEARCH_MAX_PER_WINDOW = 1;

const searchBuckets = new Map<string, { count: number; resetAt: number }>();

function consumeBucket(
  buckets: Map<string, { count: number; resetAt: number }>,
  key: string,
  windowMs: number,
  maxPerWindow: number,
): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= maxPerWindow) {
    return false;
  }

  bucket.count += 1;
  return true;
}

export function buildProspectingRateLimitKey(
  organizationId: string,
  userId: string,
): string {
  return `${organizationId}:${userId}`;
}

export function checkProspectingSearchRateLimit(
  organizationId: string,
  userId: string,
): boolean {
  const key = buildProspectingRateLimitKey(organizationId, userId);
  return consumeBucket(searchBuckets, key, SEARCH_WINDOW_MS, SEARCH_MAX_PER_WINDOW);
}

export const PROSPECTING_SEARCH_RATE_LIMIT_MS = SEARCH_WINDOW_MS;
