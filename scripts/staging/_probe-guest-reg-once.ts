import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), ".env.staging"), override: true });
execSync("node scripts/staging/assert-staging-db.mjs", {
  stdio: "inherit",
  env: process.env,
});

async function main() {
  const { db } = await import("@/lib/db");
  const { getGuestRegistrationLookupResult } = await import(
    "@/services/guests/guest-registration.service"
  );

  const row = await db.guestRegistrationToken.findFirst({
    where: {
      reservation: { internalNotes: { contains: "[WEB_BUILDER]" } },
      status: "ACTIVE",
    },
    orderBy: { createdAt: "desc" },
    select: { token: true, reservationId: true },
  });

  if (!row) {
    console.log(JSON.stringify({ ok: false, reason: "no_active_web_token" }));
    await db.$disconnect();
    return;
  }

  const lookup = await getGuestRegistrationLookupResult(row.token);
  const foreign = await getGuestRegistrationLookupResult("not-a-real-token");

  console.log(
    JSON.stringify(
      {
        ok: true,
        tokenPrefix: row.token.slice(0, 8),
        reservationId: row.reservationId,
        lookupState: lookup.state,
        platform:
          lookup.state === "valid" ? lookup.reservation.platform : null,
        reservationCode:
          lookup.state === "valid" ? lookup.reservation.reservationCode : null,
        foreignState: foreign.state,
      },
      null,
      2,
    ),
  );

  await db.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
