import "server-only";

/** PRAGMA-owned TTLock Developer app credentials (never exposed to tenants). */
export function getPlatformTTLockClientId(): string | null {
  const value = process.env.TTLOCK_CLIENT_ID?.trim();
  return value || null;
}

export function getPlatformTTLockClientSecret(): string | null {
  const value = process.env.TTLOCK_CLIENT_SECRET?.trim();
  return value || null;
}

export function isPlatformTTLockConfigured(): boolean {
  return Boolean(getPlatformTTLockClientId() && getPlatformTTLockClientSecret());
}
