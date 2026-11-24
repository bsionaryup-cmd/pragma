/**
 * Repair: GR completed + lock mapped but no active synced TTLock code.
 * Generates code and runs completion emails (reception + guest + tenant).
 *
 *   npx tsx --require ./scripts/preload-stub-server-only.cjs scripts/_repair-gr-missing-access-codes.ts
 *   npx tsx --require ./scripts/preload-stub-server-only.cjs scripts/_repair-gr-missing-access-codes.ts --dry-run
 */
import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

config();
config({ path: ".env.local", override: true });
if (process.env.TTLOCK_API_ENABLED == null) {
  process.env.TTLOCK_API_ENABLED = "true";
}

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const { AccessCredentialStatus, ReservationStatus } = await import(
    "@prisma/client"
  );
  const { db } = await import("../src/lib/db");
  const { formatAccessCode } = await import("../src/lib/access-code");
  const { decryptTTLockSecret } = await import(
    "../src/services/integrations/ttlock/ttlock-crypto"
  );
  const { runGuestRegistrationCompletionComms } = await import(
    "../src/services/guests/guest-registration-completion-comms.service"
  );

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const candidates = await db.reservation.findMany({
    where: {
      guestRegistrationCompletedAt: { not: null },
      status: {
        in: [
          ReservationStatus.CONFIRMED,
          ReservationStatus.CHECKED_IN,
          ReservationStatus.CHECKOUT_TODAY,
        ],
      },
      checkOut: { gte: today },
      property: { propertyLock: { isNot: null } },
    },
    orderBy: { checkIn: "asc" },
    select: {
      id: true,
      guestName: true,
      reservationCode: true,
      status: true,
      checkIn: true,
      checkOut: true,
      guestRegistrationCompletedAt: true,
      guestRegistrationAdminNotifiedAt: true,
      property: {
        select: {
          unitNumber: true,
          name: true,
          propertyLock: { select: { ttlockLockId: true } },
        },
      },
      accessCredentials: {
        where: {
          ttlockCodeId: { not: null },
          status: {
            in: [
              AccessCredentialStatus.GENERATED,
              AccessCredentialStatus.SENT,
              AccessCredentialStatus.ACTIVE,
            ],
          },
        },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, ttlockCodeId: true, deliveryStatus: true },
      },
    },
  });

  const gaps = candidates.filter((r) => {
    if (!r.property.propertyLock?.ttlockLockId) return false;
    return r.accessCredentials.length === 0;
  });

  const evidence: Record<string, unknown> = {
    startedAt: new Date().toISOString(),
    dryRun,
    scanned: candidates.length,
    gapCount: gaps.length,
    gaps: gaps.map((g) => ({
      id: g.id,
      guest: g.guestName,
      unit: g.property.unitNumber,
      status: g.status,
      checkIn: g.checkIn,
      checkOut: g.checkOut,
      adminNotifiedAt: g.guestRegistrationAdminNotifiedAt,
    })),
    results: [] as unknown[],
  };

  if (dryRun) {
    const outPath = join(
      "docs",
      "audits",
      "evidence",
      "gr-missing-access-repair-dryrun.json",
    );
    mkdirSync(join("docs", "audits", "evidence"), { recursive: true });
    writeFileSync(outPath, JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify({ ok: true, outPath, gapCount: gaps.length }, null, 2));
    await db.$disconnect();
    return;
  }

  for (const gap of gaps) {
    const result = await runGuestRegistrationCompletionComms(gap.id, {
      forceResend: true,
      triggeredBy: "manual",
      userId: "repair-script",
    });

    const cred = await db.accessCredential.findFirst({
      where: {
        reservationId: gap.id,
        ttlockCodeId: { not: null },
        status: {
          in: [
            AccessCredentialStatus.GENERATED,
            AccessCredentialStatus.SENT,
            AccessCredentialStatus.ACTIVE,
          ],
        },
      },
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

    const uiCode = cred
      ? formatAccessCode(decryptTTLockSecret(cred.codeEncrypted))
      : null;

    (evidence.results as unknown[]).push({
      reservationId: gap.id,
      guest: gap.guestName,
      unit: gap.property.unitNumber,
      comms: result,
      credential: cred
        ? {
            id: cred.id,
            status: cred.status,
            deliveryStatus: cred.deliveryStatus,
            ttlockCodeId: cred.ttlockCodeId,
            validFrom: cred.validFrom,
            validTo: cred.validTo,
            uiCode,
          }
        : null,
      visibleOk: Boolean(uiCode && cred?.ttlockCodeId),
    });
  }

  const results = evidence.results as Array<{ visibleOk?: boolean }>;
  evidence.ok = results.length === 0 || results.every((r) => r.visibleOk);
  evidence.finishedAt = new Date().toISOString();

  const outPath = join(
    "docs",
    "audits",
    "evidence",
    "gr-missing-access-repair.json",
  );
  mkdirSync(join("docs", "audits", "evidence"), { recursive: true });
  writeFileSync(outPath, JSON.stringify(evidence, null, 2));
  console.log(
    JSON.stringify(
      {
        ok: evidence.ok,
        outPath,
        gapCount: gaps.length,
        repaired: results.filter((r) => r.visibleOk).length,
      },
      null,
      2,
    ),
  );

  await db.$disconnect();
  if (!evidence.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
