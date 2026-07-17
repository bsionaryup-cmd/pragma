import "server-only";

import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const SESSION_TTL_SECONDS = 15 * 60;

export type ConciergeExtensionSessionPayload = {
  v: 1;
  linkId: string;
  organizationId: string;
  userId: string;
  deviceHash: string;
  exp: number;
};

function getSigningSecret(): string {
  const secret = process.env.CONCIERGE_EXTENSION_SECRET?.trim();
  if (!secret) {
    throw new Error("CONCIERGE_EXTENSION_SECRET no configurado");
  }
  return secret;
}

function sign(encodedPayload: string): string {
  return createHmac("sha256", getSigningSecret())
    .update(encodedPayload)
    .digest("base64url");
}

export function hashConciergeDeviceId(deviceId: string): string {
  return createHash("sha256").update(deviceId.trim()).digest("hex");
}

export function createConciergePairingSecret(): {
  raw: string;
  hash: string;
} {
  const raw = randomBytes(32).toString("base64url");
  return {
    raw,
    hash: createHash("sha256").update(raw).digest("hex"),
  };
}

export function hashConciergePairingSecret(raw: string): string {
  return createHash("sha256").update(raw.trim()).digest("hex");
}

export function createConciergeExtensionSession(input: {
  linkId: string;
  organizationId: string;
  userId: string;
  deviceHash: string;
}): { token: string; expiresAt: string } {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload: ConciergeExtensionSessionPayload = {
    v: 1,
    linkId: input.linkId,
    organizationId: input.organizationId,
    userId: input.userId,
    deviceHash: input.deviceHash,
    exp,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  return {
    token: `${encoded}.${sign(encoded)}`,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

export function verifyConciergeExtensionSession(
  token: string,
): ConciergeExtensionSessionPayload | null {
  const [encoded, providedSignature, extra] = token.trim().split(".");
  if (!encoded || !providedSignature || extra) return null;

  const expectedSignature = sign(encoded);
  const expected = Buffer.from(expectedSignature);
  const provided = Buffer.from(providedSignature);
  if (
    expected.length !== provided.length ||
    !timingSafeEqual(expected, provided)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as Partial<ConciergeExtensionSessionPayload>;
    if (
      parsed.v !== 1 ||
      typeof parsed.linkId !== "string" ||
      typeof parsed.organizationId !== "string" ||
      typeof parsed.userId !== "string" ||
      typeof parsed.deviceHash !== "string" ||
      typeof parsed.exp !== "number" ||
      parsed.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return parsed as ConciergeExtensionSessionPayload;
  } catch {
    return null;
  }
}
