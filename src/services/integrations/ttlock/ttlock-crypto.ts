import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const SECRET_PREFIX = "enc:v1:";

type KeySource = { name: string; value: string };

/**
 * Ordered key candidates for TTLock secret crypto.
 * Encrypt uses the first available source (stable primary).
 * Decrypt tries each until one authenticates (Dev→Prod / key-rotation safe).
 */
function listTTLockEncryptionKeySources(): KeySource[] {
  const out: KeySource[] = [];
  const add = (name: string, value: string | undefined) => {
    const trimmed = value?.trim();
    if (!trimmed) return;
    if (out.some((entry) => entry.value === trimmed)) return;
    out.push({ name, value: trimmed });
  };

  add("TTLOCK_ENCRYPTION_KEY", process.env.TTLOCK_ENCRYPTION_KEY);
  add(
    "TTLOCK_ENCRYPTION_KEY_LEGACY",
    process.env.TTLOCK_ENCRYPTION_KEY_LEGACY,
  );
  add("CLERK_SECRET_KEY", process.env.CLERK_SECRET_KEY);
  add("DATABASE_URL", process.env.DATABASE_URL);
  return out;
}

function keyBufferFromSource(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

export function getTTLockEncryptionKey(): Buffer {
  const sources = listTTLockEncryptionKeySources();
  if (sources.length === 0) {
    throw new Error("No hay clave servidor para cifrar TTLock");
  }
  return keyBufferFromSource(sources[0]!.value);
}

export function encryptTTLockSecret(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getTTLockEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(trimmed, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${SECRET_PREFIX}${Buffer.concat([iv, tag, encrypted]).toString("base64")}`;
}

export function decryptTTLockSecret(value: string | null | undefined): string | null {
  if (!value?.startsWith(SECRET_PREFIX)) return null;

  const sources = listTTLockEncryptionKeySources();
  if (sources.length === 0) {
    console.error("[ttlock-crypto] decrypt failed: no encryption key sources");
    return null;
  }

  let lastError: unknown = null;
  for (const source of sources) {
    try {
      const raw = Buffer.from(value.slice(SECRET_PREFIX.length), "base64");
      const iv = raw.subarray(0, 12);
      const tag = raw.subarray(12, 28);
      const encrypted = raw.subarray(28);
      const decipher = createDecipheriv(
        "aes-256-gcm",
        keyBufferFromSource(source.value),
        iv,
      );
      decipher.setAuthTag(tag);
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]);
      return decrypted.toString("utf8");
    } catch (error) {
      lastError = error;
    }
  }

  // Wrong/rotated key (e.g. CLERK_SECRET_KEY fallback after Dev→Prod) must not
  // take down /panel or smart-access — callers already treat null as missing.
  console.error(
    "[ttlock-crypto] decrypt failed for all key sources:",
    lastError instanceof Error ? lastError.message : lastError,
  );
  return null;
}

/** TTLock OAuth expects the account password as lowercase MD5 hex. */
export function ttlockPasswordMd5(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return createHash("md5").update(trimmed, "utf8").digest("hex");
}
