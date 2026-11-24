import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import {
  OPERATIONAL_ACCESS_MAX_DURATION_MS,
  createOperationalAccessCodeSchema,
  parseOperationalLocalDateTime,
  validateOperationalAccessWindow,
} from "../../src/services/integrations/ttlock/operational-access.schema";

const ROOT = process.cwd();

describe("TTLock operational access window", () => {
  it("interprets form dates as America/Bogota wall time", () => {
    const parsed = parseOperationalLocalDateTime("2026-08-15T09:30");
    assert.equal(parsed?.toISOString(), "2026-08-15T14:30:00.000Z");
  });

  it("rejects impossible local dates", () => {
    assert.equal(
      parseOperationalLocalDateTime("2026-02-30T09:30"),
      null,
    );
  });

  it("accepts a future window and rejects inverted or expired windows", () => {
    const now = new Date("2026-08-15T12:00:00.000Z");
    assert.deepEqual(
      validateOperationalAccessWindow({
        validFrom: new Date("2026-08-15T13:00:00.000Z"),
        validTo: new Date("2026-08-15T15:00:00.000Z"),
        now,
      }),
      { ok: true },
    );
    assert.equal(
      validateOperationalAccessWindow({
        validFrom: new Date("2026-08-15T15:00:00.000Z"),
        validTo: new Date("2026-08-15T13:00:00.000Z"),
        now,
      }).ok,
      false,
    );
    assert.equal(
      validateOperationalAccessWindow({
        validFrom: new Date("2026-08-14T13:00:00.000Z"),
        validTo: new Date("2026-08-14T15:00:00.000Z"),
        now,
      }).ok,
      false,
    );
  });

  it("caps long-lived operational credentials", () => {
    const now = new Date("2026-08-15T12:00:00.000Z");
    const validFrom = new Date("2026-08-15T13:00:00.000Z");
    const validTo = new Date(
      validFrom.getTime() + OPERATIONAL_ACCESS_MAX_DURATION_MS + 1,
    );
    assert.equal(
      validateOperationalAccessWindow({ validFrom, validTo, now }).ok,
      false,
    );
  });

  it("accepts an empty random choice or a custom TTLock PIN", () => {
    const base = {
      propertyId: "property-1",
      label: "Técnico",
      type: "MAINTENANCE" as const,
      validFromLocal: "2026-08-15T09:30",
      validToLocal: "2026-08-15T11:30",
      idempotencyKey: "a9f8a5dd-cf17-49d0-b98d-cd74ed770503",
    };
    assert.equal(
      createOperationalAccessCodeSchema.safeParse({
        ...base,
        customCode: "",
      }).success,
      true,
    );
    assert.equal(
      createOperationalAccessCodeSchema.safeParse({
        ...base,
        customCode: "012345",
      }).success,
      true,
    );
  });

  it("rejects custom PINs outside TTLock's 4-9 digit contract", () => {
    const base = {
      propertyId: "property-1",
      label: "Técnico",
      type: "MAINTENANCE" as const,
      validFromLocal: "2026-08-15T09:30",
      validToLocal: "2026-08-15T11:30",
      idempotencyKey: "a9f8a5dd-cf17-49d0-b98d-cd74ed770503",
    };
    for (const customCode of ["123", "1234567890", "12A45"]) {
      assert.equal(
        createOperationalAccessCodeSchema.safeParse({
          ...base,
          customCode,
        }).success,
        false,
      );
    }
  });
});

describe("TTLock operational access isolation contract", () => {
  it("keeps reservation credentials unchanged and uses a separate model", async () => {
    const schema = await readFile(
      path.join(ROOT, "prisma", "schema.prisma"),
      "utf8",
    );
    assert.match(
      schema,
      /model AccessCredential\s*\{[\s\S]*?reservationId\s+String\b/,
    );
    assert.match(schema, /model OperationalAccessCredential\s*\{/);
    const operationalModel =
      schema.match(/model OperationalAccessCredential\s*\{[\s\S]*?\n\}/)?.[0] ??
      "";
    assert.doesNotMatch(operationalModel, /\breservationId\b/);
  });

  it("fails closed around TTLock API and never invokes reservation flows", async () => {
    const source = await readFile(
      path.join(
        ROOT,
        "src",
        "services",
        "integrations",
        "ttlock",
        "ttlock-operational-access.service.ts",
      ),
      "utf8",
    );
    assert.match(source, /requestTTLockAddKeyboardPwd/);
    assert.match(source, /requestTTLockDeleteKeyboardPwd/);
    assert.match(source, /isTTLockLiveApiEnabled/);
    assert.match(source, /status:\s*AccessCredentialStatus\.PENDING/);
    assert.match(source, /ttlockCodeId:\s*String\(result\.keyboardPwdId\)/);
    assert.match(
      source,
      /parsed\.data\.customCode\s*\|\|\s*generateOperationalPasscode\(\)/,
    );
    assert.match(source, /keyboardPwd:\s*formatAccessCodeForLockApi\(passcode\)/);
    assert.doesNotMatch(source, /generateAccessCodeForReservation/);
    assert.doesNotMatch(source, /guest-registration/);
  });

  it("authorizes every mutation and scopes it to the current tenant", async () => {
    const actions = await readFile(
      path.join(
        ROOT,
        "src",
        "features",
        "smart-access",
        "actions",
        "operational-access.actions.ts",
      ),
      "utf8",
    );
    assert.match(actions, /requirePermission\("access:manage"\)/);
    assert.match(actions, /requireTenantDataScope\(\)/);
    assert.match(actions, /createOperationalAccessCode\(\s*input,\s*scope,/);
    assert.match(actions, /revokeOperationalAccessCode\(\s*credentialId,\s*scope,/);
  });

  it("runs operational expiry from the existing TTLock cron", async () => {
    const scheduler = await readFile(
      path.join(
        ROOT,
        "src",
        "modules",
        "integrations",
        "ttlock",
        "ttlock.scheduler.ts",
      ),
      "utf8",
    );
    assert.match(scheduler, /purgeExpiredOperationalAccessCodes/);

    const vercelConfig = await readFile(
      path.join(ROOT, "vercel.json"),
      "utf8",
    );
    assert.match(
      vercelConfig,
      /"path": "\/api\/cron\/ttlock-sync"[\s\S]*?"schedule": "(\*\/\d+|\d+) \* \* \* \*"/,
    );
  });
});

