/**
 * Assert GR→TTLock auto path SSOT after restoration.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
async function read(rel) {
  return readFile(path.join(root, rel), "utf8");
}

const schema = await read("prisma/schema.prisma");
assert.match(
  schema,
  /generateAfterGuestRegistration\s+Boolean\s+@default\(true\)/,
);

const migration = await read(
  "prisma/migrations/20260727010000_ttlock_generate_after_gr_default_true/migration.sql",
);
assert.match(migration, /SET DEFAULT true/);
assert.match(migration, /generateAfterGuestRegistration" = true/);

const finalize = await read("src/services/guests/guest-registration.service.ts");
assert.match(finalize, /settleGuestRegistrationCompletionComms/);

const comms = await read(
  "src/services/guests/guest-registration-completion-comms.service.ts",
);
assert.match(comms, /must get the code even if/);
assert.match(comms, /settleGuestRegistrationCompletionComms/);
assert.match(comms, /revalidatePath\("\/calendar"\)/);
assert.doesNotMatch(comms, /Esperando correo de recepción exitoso/);
assert.doesNotMatch(comms, /Only if \(2\) ok/);

const detail = await read("src/services/reservations/reservation.service.ts");
assert.match(detail, /ttlockCodeId:\s*\{\s*not:\s*null\s*\}/);

const client = await read("src/modules/integrations/ttlock/ttlock.client.ts");
assert.match(client, /SYNC_ERROR/);
assert.match(client, /canResolveTTLockApiSession/);

console.log("gr-ttlock-flow assert OK");
