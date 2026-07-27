import { config } from "dotenv";
config();
config({ path: ".env.local", override: true });

const id = process.argv[2] || "cms2le693000t6gty42fajvze";

const { runGuestRegistrationCompletionComms } = await import(
  "../src/services/guests/guest-registration-completion-comms.service.ts"
);
const { db } = await import("../src/lib/db.ts");
const { formatAccessCode } = await import("../src/lib/access-code.ts");
const { decryptTTLockSecret } = await import(
  "../src/services/integrations/ttlock/ttlock-crypto.ts"
);
const { isTTLockLiveApiEnabled } = await import(
  "../src/services/integrations/ttlock/ttlock-oauth.client.ts"
);

console.log("liveApiEnabled", isTTLockLiveApiEnabled());

const result = await runGuestRegistrationCompletionComms(id, {
  forceResend: true,
  triggeredBy: "manual",
  userId: "repair-latest-gr",
});

const cred = await db.accessCredential.findFirst({
  where: { reservationId: id, ttlockCodeId: { not: null } },
  orderBy: { createdAt: "desc" },
  select: {
    id: true,
    status: true,
    deliveryStatus: true,
    ttlockCodeId: true,
    codeEncrypted: true,
    validFrom: true,
    validTo: true,
  },
});

console.log(
  JSON.stringify(
    {
      result,
      credential: cred
        ? {
            id: cred.id,
            status: cred.status,
            deliveryStatus: cred.deliveryStatus,
            ttlockCodeId: cred.ttlockCodeId,
            validFrom: cred.validFrom,
            validTo: cred.validTo,
            uiCode: formatAccessCode(decryptTTLockSecret(cred.codeEncrypted)),
          }
        : null,
    },
    null,
    2,
  ),
);

await db.$disconnect();
