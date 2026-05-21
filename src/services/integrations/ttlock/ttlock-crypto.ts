import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const SECRET_PREFIX = "enc:v1:";

export function getTTLockEncryptionKey(): Buffer {
  const source =
    process.env.TTLOCK_ENCRYPTION_KEY ||
    process.env.CLERK_SECRET_KEY ||
    process.env.DATABASE_URL;
  if (!source) {
    throw new Error("No hay clave servidor para cifrar TTLock");
  }
  return createHash("sha256").update(source).digest();
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

  const raw = Buffer.from(value.slice(SECRET_PREFIX.length), "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", getTTLockEncryptionKey(), iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

/** TTLock OAuth expects the account password as lowercase MD5 hex. */
export function ttlockPasswordMd5(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return createHash("md5").update(trimmed, "utf8").digest("hex");
}
