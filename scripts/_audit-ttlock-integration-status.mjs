import { config } from "dotenv";
config();
config({ path: ".env.local", override: true });

const { db } = await import("../src/lib/db.ts");

const property = await db.property.findFirst({
  where: {
    OR: [
      { unitNumber: "801" },
      { name: { contains: "Margarita", mode: "insensitive" } },
    ],
    propertyLock: { isNot: null },
  },
  select: {
    id: true,
    name: true,
    unitNumber: true,
    propertyLock: {
      select: {
        ttlockLockId: true,
        integrationId: true,
        integration: {
          select: {
            id: true,
            status: true,
            isActive: true,
            lastError: true,
            lastSyncedAt: true,
            expiresAt: true,
            accessTokenEncrypted: true,
          },
        },
      },
    },
  },
});

const marcio = await db.reservation.findUnique({
  where: { id: "cmrzp9lu0000404ifnwpb1z1e" },
  select: {
    id: true,
    guestName: true,
    property: {
      select: {
        id: true,
        name: true,
        unitNumber: true,
        propertyLock: {
          select: {
            integration: {
              select: { id: true, status: true, isActive: true, lastError: true },
            },
          },
        },
      },
    },
  },
});

console.log(
  JSON.stringify(
    {
      margarita: {
        ...property,
        propertyLock: property?.propertyLock
          ? {
              ...property.propertyLock,
              integration: property.propertyLock.integration
                ? {
                    ...property.propertyLock.integration,
                    hasAccessToken: Boolean(
                      property.propertyLock.integration.accessTokenEncrypted,
                    ),
                    accessTokenEncrypted: undefined,
                  }
                : null,
            }
          : null,
      },
      marcio,
    },
    null,
    2,
  ),
);

await db.$disconnect();
