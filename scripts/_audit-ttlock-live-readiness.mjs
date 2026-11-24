import { config } from "dotenv";
config();
config({ path: ".env.local", override: true });

const { db } = await import("../src/lib/db.ts");
const { isTTLockLiveApiEnabled } = await import(
  "../src/services/integrations/ttlock/ttlock-oauth.client.ts"
);
const { isPlatformTTLockConfigured } = await import(
  "../src/lib/integrations/ttlock-platform.ts"
);

const integrations = await db.tTLockIntegration.findMany({
  select: {
    id: true,
    status: true,
    clientId: true,
    clientSecretEncrypted: true,
    accessTokenEncrypted: true,
    refreshTokenEncrypted: true,
    expiresAt: true,
    environment: true,
  },
});

console.log(
  JSON.stringify(
    {
      env: {
        TTLOCK_API_ENABLED: process.env.TTLOCK_API_ENABLED ?? null,
        platformConfigured: isPlatformTTLockConfigured(),
        liveApiEnabled: isTTLockLiveApiEnabled(),
        hasClientIdEnv: Boolean(process.env.TTLOCK_CLIENT_ID?.trim()),
      },
      integrations: integrations.map((i) => ({
        id: i.id,
        status: i.status,
        environment: i.environment,
        hasClientId: Boolean(i.clientId?.trim()),
        hasClientSecret: Boolean(i.clientSecretEncrypted),
        hasAccessToken: Boolean(i.accessTokenEncrypted),
        hasRefreshToken: Boolean(i.refreshTokenEncrypted),
        expiresAt: i.expiresAt,
      })),
    },
    null,
    2,
  ),
);

await db.$disconnect();
