import { config } from "dotenv";
config();
config({ path: ".env.local", override: true });

const { db } = await import("../src/lib/db.ts");
const { formatAccessCode } = await import("../src/lib/access-code.ts");
const { decryptTTLockSecret } = await import(
  "../src/services/integrations/ttlock/ttlock-crypto.ts"
);

const creds = await db.accessCredential.findMany({
  where: {
    ttlockCodeId: { not: null },
    status: { in: ["GENERATED", "SENT", "ACTIVE"] },
  },
  orderBy: { createdAt: "desc" },
  take: 8,
  select: {
    reservationId: true,
    status: true,
    ttlockCodeId: true,
    codeEncrypted: true,
    validFrom: true,
    validTo: true,
    reservation: {
      select: {
        guestName: true,
        guestRegistrationCompletedAt: true,
        status: true,
      },
    },
  },
});

for (const c of creds) {
  console.log(
    JSON.stringify({
      reservationId: c.reservationId,
      guest: c.reservation.guestName,
      resStatus: c.reservation.status,
      gr: Boolean(c.reservation.guestRegistrationCompletedAt),
      status: c.status,
      code: formatAccessCode(decryptTTLockSecret(c.codeEncrypted)),
      ttlockCodeId: c.ttlockCodeId,
      hasValidity: Boolean(c.validFrom && c.validTo),
    }),
  );
}

await db.$disconnect();
