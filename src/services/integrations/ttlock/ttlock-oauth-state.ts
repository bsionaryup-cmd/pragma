import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const STATE_TTL_MS = 15 * 60 * 1000;

export const TTLOCK_OAUTH_STATE_COOKIE = "pragma_ttlock_oauth_state";

function signPayload(payload: string): string {
  const secret =
    process.env.TTLOCK_ENCRYPTION_KEY ||
    process.env.CLERK_SECRET_KEY ||
    process.env.DATABASE_URL ||
    "pragma-ttlock-dev";
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createTTLockOAuthState(
  userId: string,
  organizationId: string | null = null,
): string {
  const issuedAt = Date.now();
  const nonce = randomBytes(12).toString("hex");
  const orgKey = organizationId ?? "_";
  const payload = `${userId}.${orgKey}.${issuedAt}.${nonce}`;
  const signature = signPayload(payload);
  return Buffer.from(`${payload}.${signature}`).toString("base64url");
}

export function verifyTTLockOAuthState(
  state: string,
): { userId: string; organizationId: string | null } | null {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const lastDot = decoded.lastIndexOf(".");
    if (lastDot <= 0) return null;

    const payload = decoded.slice(0, lastDot);
    const signature = decoded.slice(lastDot + 1);
    const expected = signPayload(payload);

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const segments = payload.split(".");
    let userId: string | undefined;
    let organizationId: string | null = null;
    let issuedAtRaw: string | undefined;

    if (segments.length === 3) {
      [userId, issuedAtRaw] = [segments[0], segments[1]];
    } else if (segments.length >= 4) {
      userId = segments[0];
      organizationId = segments[1] === "_" ? null : segments[1];
      issuedAtRaw = segments[2];
    }

    const issuedAt = Number(issuedAtRaw);
    if (!userId || !Number.isFinite(issuedAt)) return null;
    if (Date.now() - issuedAt > STATE_TTL_MS) return null;

    return { userId, organizationId };
  } catch {
    return null;
  }
}
