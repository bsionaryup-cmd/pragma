import { config } from "dotenv";
config();
config({ path: ".env.local", override: true });
if (process.env.TTLOCK_API_ENABLED == null) {
  process.env.TTLOCK_API_ENABLED = "true";
}

const { db } = await import("../src/lib/db.ts");
const { formatAccessCode } = await import("../src/lib/access-code.ts");
const { decryptTTLockSecret } = await import(
  "../src/services/integrations/ttlock/ttlock-crypto.ts"
);
const { isTTLockLiveApiEnabled } = await import(
  "../src/services/integrations/ttlock/ttlock-oauth.client.ts"
);
const { resolveTTLockApiSessionForProperty } = await import(
  "../src/modules/integrations/ttlock/ttlock.client.ts"
);
const { resolveTTLockAutomationSettingsForProperty } = await import(
  "../src/modules/integrations/ttlock/ttlock.persistence.ts"
);

const recent = await db.reservation.findMany({
  where: { guestRegistrationCompletedAt: { not: null } },
  orderBy: { guestRegistrationCompletedAt: "desc" },
  take: 5,
  select: {
    id: true,
    guestName: true,
    reservationCode: true,
    status: true,
    guestEmail: true,
    guestRegistrationCompletedAt: true,
    guestRegistrationAdminNotifiedAt: true,
    guestRegistrationAdminNotificationError: true,
    checkIn: true,
    checkOut: true,
    propertyId: true,
    property: {
      select: {
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
                expiresAt: true,
              },
            },
          },
        },
      },
    },
    accessCredentials: {
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        status: true,
        deliveryStatus: true,
        ttlockCodeId: true,
        codeEncrypted: true,
        createdAt: true,
      },
    },
  },
});

const reports = [];
for (const r of recent) {
  const events = await db.accessEvent.findMany({
    where: { reservationId: r.id },
    orderBy: { createdAt: "desc" },
    take: 12,
    select: { eventType: true, payload: true, createdAt: true },
  });
  const settings = await resolveTTLockAutomationSettingsForProperty(
    r.propertyId,
  );
  const session = r.property.propertyLock
    ? await resolveTTLockApiSessionForProperty(r.propertyId)
    : null;

  const synced = r.accessCredentials.find((c) => c.ttlockCodeId) ?? null;
  reports.push({
    id: r.id,
    guest: r.guestName,
    code: r.reservationCode,
    unit: r.property.unitNumber,
    grAt: r.guestRegistrationCompletedAt,
    adminAt: r.guestRegistrationAdminNotifiedAt,
    adminError: r.guestRegistrationAdminNotificationError,
    checkIn: r.checkIn,
    checkOut: r.checkOut,
    lockId: r.property.propertyLock?.ttlockLockId ?? null,
    integrationStatus: r.property.propertyLock?.integration?.status ?? null,
    integrationError: r.property.propertyLock?.integration?.lastError ?? null,
    generateAfterGR: settings?.generateAfterGuestRegistration ?? null,
    liveApiEnabled: isTTLockLiveApiEnabled(),
    sessionOk: Boolean(session?.accessToken && session.accessToken !== "placeholder-token"),
    creds: r.accessCredentials.map((c) => ({
      id: c.id,
      status: c.status,
      delivery: c.deliveryStatus,
      ttlockCodeId: c.ttlockCodeId,
      uiCode: c.ttlockCodeId
        ? formatAccessCode(decryptTTLockSecret(c.codeEncrypted))
        : null,
      createdAt: c.createdAt,
    })),
    events,
  });
}

console.log(JSON.stringify({ latest: reports }, null, 2));
await db.$disconnect();
