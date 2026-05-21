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

export function createTTLockOAuthState(userId: string): string {
  const issuedAt = Date.now();
  const nonce = randomBytes(12).toString("hex");
  const payload = `${userId}.${issuedAt}.${nonce}`;
  const signature = signPayload(payload);
  return Buffer.from(`${payload}.${signature}`).toString("base64url");
}

export function verifyTTLockOAuthState(state: string): { userId: string } | null {
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

    const [userId, issuedAtRaw] = payload.split(".");
    const issuedAt = Number(issuedAtRaw);
    if (!userId || !Number.isFinite(issuedAt)) return null;
    if (Date.now() - issuedAt > STATE_TTL_MS) return null;

    return { userId };
  } catch {
    return null;
  }
}
