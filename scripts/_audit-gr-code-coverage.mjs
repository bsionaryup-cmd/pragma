/**
 * Audit: reservations with GR completed vs TTLock credential visibility.
 */
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

const reservations = await db.reservation.findMany({
  where: {
    guestRegistrationCompletedAt: { not: null },
    status: { notIn: ["CANCELLED", "BLOCKED"] },
  },
  orderBy: { guestRegistrationCompletedAt: "desc" },
  take: 80,
  select: {
    id: true,
    guestName: true,
    reservationCode: true,
    status: true,
    guestEmail: true,
    guestRegistrationCompletedAt: true,
    guestRegistrationAdminNotifiedAt: true,
    guestRegistrationAdminNotificationError: true,
    propertyId: true,
    property: {
      select: {
        name: true,
        unitNumber: true,
        propertyLock: {
          select: {
            id: true,
            ttlockLockId: true,
            integrationId: true,
            integration: {
              select: {
                id: true,
                status: true,
                isActive: true,
                lastError: true,
              },
            },
          },
        },
      },
    },
    accessCredentials: {
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        status: true,
        deliveryStatus: true,
        ttlockCodeId: true,
        codeEncrypted: true,
        validFrom: true,
        validTo: true,
        createdAt: true,
      },
    },
  },
});

const rows = [];
for (const r of reservations) {
  const latest = r.accessCredentials[0] ?? null;
  const synced =
    r.accessCredentials.find((c) => c.ttlockCodeId) ?? null;
  const decryptOk = synced
    ? Boolean(decryptTTLockSecret(synced.codeEncrypted))
    : latest
      ? Boolean(decryptTTLockSecret(latest.codeEncrypted))
      : false;
  const uiCode = synced
    ? formatAccessCode(decryptTTLockSecret(synced.codeEncrypted))
    : null;

  const lock = r.property.propertyLock;
  let settings = null;
  if (r.propertyId) {
    settings = await resolveTTLockAutomationSettingsForProperty(r.propertyId);
  }
  let sessionOk = false;
  if (lock?.ttlockLockId) {
    const session = await resolveTTLockApiSessionForProperty(r.propertyId);
    sessionOk = Boolean(session?.accessToken);
  }

  let bucket = "OK_VISIBLE";
  if (!lock?.ttlockLockId) bucket = "NO_LOCK_MAPPED";
  else if (!synced && latest && !latest.ttlockCodeId)
    bucket = "PHANTOM_LOCAL_ONLY";
  else if (!synced) bucket = "MISSING_CREDENTIAL";
  else if (!decryptOk) bucket = "DECRYPT_FAIL";
  else if (!uiCode) bucket = "UI_CODE_NULL";
  else if (synced.deliveryStatus !== "SENT") bucket = "CODE_OK_EMAIL_NOT_SENT";

  rows.push({
    bucket,
    reservationId: r.id,
    guest: r.guestName,
    code: r.reservationCode,
    unit: r.property.unitNumber,
    property: r.property.name,
    grAt: r.guestRegistrationCompletedAt,
    guestEmail: Boolean(r.guestEmail?.trim()),
    adminNotifiedAt: r.guestRegistrationAdminNotifiedAt,
    adminError: r.guestRegistrationAdminNotificationError,
    lockMapped: Boolean(lock?.ttlockLockId),
    integrationStatus: lock?.integration?.status ?? null,
    integrationError: lock?.integration?.lastError ?? null,
    generateAfterGR: settings?.generateAfterGuestRegistration ?? null,
    sessionOk,
    latest: latest
      ? {
          id: latest.id,
          status: latest.status,
          delivery: latest.deliveryStatus,
          ttlockCodeId: latest.ttlockCodeId,
          createdAt: latest.createdAt,
        }
      : null,
    uiWouldShow: Boolean(uiCode),
    uiCode,
  });
}

const summary = {};
for (const row of rows) {
  summary[row.bucket] = (summary[row.bucket] ?? 0) + 1;
}

console.log(
  JSON.stringify(
    {
      liveApiEnabled: isTTLockLiveApiEnabled(),
      scanned: rows.length,
      summary,
      gaps: rows.filter((r) => r.bucket !== "OK_VISIBLE"),
      okSample: rows.filter((r) => r.bucket === "OK_VISIBLE").slice(0, 5),
    },
    null,
    2,
  ),
);

await db.$disconnect();
