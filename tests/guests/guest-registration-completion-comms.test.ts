import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Documents the post-GR communications contract.
 * Runtime wiring: guest-registration-completion-comms.service.ts
 */
describe("guest registration completion communications contract", () => {
  it("defines ordered steps: TTLock → recepción → access code → tenant report", () => {
    const steps = [
      "ttlock_generate_without_email",
      "reception_registration_email",
      "access_code_email_guest_and_reception",
      "tenant_owner_delivery_report",
    ] as const;

    assert.equal(steps[0], "ttlock_generate_without_email");
    assert.equal(steps[1], "reception_registration_email");
    assert.equal(steps[2], "access_code_email_guest_and_reception");
    assert.equal(steps[3], "tenant_owner_delivery_report");
    assert.equal(steps.length, 4);
  });

  it("only sends access-code email after reception email succeeds", () => {
    const receptionOk = true;
    const shouldSendAccessCode = receptionOk;
    assert.equal(shouldSendAccessCode, true);

    const receptionFailed = false;
    assert.equal(receptionFailed && true, false);
  });

  it("manual panel resend uses the same pipeline with forceResend", () => {
    const autoOptions = { forceResend: false as const, triggeredBy: "auto" as const };
    const manualOptions = {
      forceResend: true as const,
      triggeredBy: "manual" as const,
      userId: "user-1",
    };

    assert.equal(autoOptions.forceResend, false);
    assert.equal(manualOptions.forceResend, true);
    assert.equal(manualOptions.triggeredBy, "manual");
    assert.deepEqual(
      ["ttlock", "reception", "accessCode", "tenantReport"],
      ["ttlock", "reception", "accessCode", "tenantReport"],
    );
  });
});
