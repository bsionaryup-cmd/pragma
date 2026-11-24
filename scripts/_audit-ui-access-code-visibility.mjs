/**
 * Audit: AccessCredential → decrypt → UI DTO for reservation detail.
 */
import { config } from "dotenv";
config();
config({ path: ".env.local", override: true });

const { db } = await import("../src/lib/db.ts");
const { decryptTTLockSecret } = await import(
  "../src/services/integrations/ttlock/ttlock-crypto.ts"
);
const { formatAccessCode } = await import("../src/lib/access-code.ts");

const keySource = process.env.TTLOCK_ENCRYPTION_KEY
  ? "TTLOCK_ENCRYPTION_KEY"
  : process.env.CLERK_SECRET_KEY
    ? "CLERK_SECRET_KEY"
    : process.env.DATABASE_URL
      ? "DATABASE_URL"
      : "NONE";

const settings = await db.tTLockAutomationSettings.findMany({
  select: {
    integrationId: true,
    generateAfterGuestRegistration: true,
    autoSendCode: true,
  },
});

const creds = await db.accessCredential.findMany({
  orderBy: { createdAt: "desc" },
  take: 12,
  select: {
    id: true,
    reservationId: true,
    status: true,
    deliveryStatus: true,
    ttlockCodeId: true,
    codeEncrypted: true,
    createdAt: true,
    reservation: {
      select: {
        guestName: true,
        guestRegistrationCompletedAt: true,
        reservationCode: true,
      },
    },
  },
});

const rows = creds.map((c) => {
  const decrypted = decryptTTLockSecret(c.codeEncrypted);
  const uiCode =
    c.ttlockCodeId && decrypted ? formatAccessCode(decrypted) : null;
  return {
    id: c.id,
    reservationId: c.reservationId,
    guest: c.reservation?.guestName ?? null,
    code: c.reservation?.reservationCode ?? null,
    grAt: c.reservation?.guestRegistrationCompletedAt ?? null,
    status: c.status,
    delivery: c.deliveryStatus,
    ttlockCodeId: c.ttlockCodeId,
    encPrefix: c.codeEncrypted?.slice(0, 12) ?? null,
    decryptOk: Boolean(decrypted),
    uiWouldShowCode: Boolean(uiCode),
    uiCode,
    createdAt: c.createdAt,
  };
});

const decryptFail = rows.filter((r) => r.ttlockCodeId && !r.decryptOk);
const uiHidden = rows.filter((r) => r.ttlockCodeId && !r.uiWouldShowCode);

console.log(
  JSON.stringify(
    {
      keySource,
      settings,
      sampleCount: rows.length,
      decryptFailCount: decryptFail.length,
      uiHiddenDespiteTtlockId: uiHidden.length,
      rows,
    },
    null,
    2,
  ),
);

await db.$disconnect();
