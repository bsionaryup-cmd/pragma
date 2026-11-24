import { config } from "dotenv";
config();
config({ path: ".env.local", override: true });

const { db } = await import("../src/lib/db.ts");
const { decryptTTLockSecret } = await import(
  "../src/services/integrations/ttlock/ttlock-crypto.ts"
);

const integration = await db.tTLockIntegration.findUnique({
  where: { id: "cmpm12rjp000204k0392pndi6" },
  select: {
    status: true,
    lastError: true,
    accessTokenEncrypted: true,
    refreshTokenEncrypted: true,
    clientSecretEncrypted: true,
    expiresAt: true,
  },
});

const access = decryptTTLockSecret(integration?.accessTokenEncrypted);
const refresh = decryptTTLockSecret(integration?.refreshTokenEncrypted);
const secret = decryptTTLockSecret(integration?.clientSecretEncrypted);

console.log(
  JSON.stringify(
    {
      status: integration?.status,
      lastError: integration?.lastError,
      expiresAt: integration?.expiresAt,
      accessDecryptOk: Boolean(access),
      accessLen: access?.length ?? 0,
      refreshDecryptOk: Boolean(refresh),
      clientSecretDecryptOk: Boolean(secret),
      accessPrefix: integration?.accessTokenEncrypted?.slice(0, 12) ?? null,
      keySource: process.env.TTLOCK_ENCRYPTION_KEY
        ? "TTLOCK_ENCRYPTION_KEY"
        : process.env.CLERK_SECRET_KEY
          ? "CLERK_SECRET_KEY"
          : "DATABASE_URL",
    },
    null,
    2,
  ),
);

await db.$disconnect();
