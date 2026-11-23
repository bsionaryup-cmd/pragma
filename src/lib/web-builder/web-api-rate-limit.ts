const WINDOW_MS = 60_000;
const MAX_REQUESTS = 40;

type Bucket = { count: number; windowStart: number };

const buckets = new Map<string, Bucket>();

export function checkWebBuilderApiRateLimit(ip: string): boolean {
  const key = ip.trim() || "unknown";
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || now - current.windowStart > WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now });
    return true;
  }

  if (current.count >= MAX_REQUESTS) {
    return false;
  }

  current.count += 1;
  return true;
}