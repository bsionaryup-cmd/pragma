import assert from "node:assert/strict";
import {
  getLatestGuestRegistrationInviteLogEntry,
  isValidGuestInviteEmail,
  parseGuestRegistrationInviteLog,
} from "../../src/lib/guest-registration/guest-registration-invite-email-log";

function testParseInviteLog() {
  const log = parseGuestRegistrationInviteLog([
    {
      at: "2026-07-16T12:00:00.000Z",
      status: "success",
      recipient: "Guest@Example.com",
      providerId: "re_123",
      triggeredBy: "auto",
    },
    { bad: true },
  ]);

  assert.equal(log.length, 1);
  assert.equal(log[0]!.recipient, "guest@example.com");
  assert.equal(log[0]!.providerId, "re_123");
  assert.equal(
    getLatestGuestRegistrationInviteLogEntry(log)?.providerId,
    "re_123",
  );
}

function testEmailValidation() {
  assert.equal(isValidGuestInviteEmail("a@b.co"), true);
  assert.equal(isValidGuestInviteEmail("  A@B.CO "), true);
  assert.equal(isValidGuestInviteEmail(""), false);
  assert.equal(isValidGuestInviteEmail("not-an-email"), false);
  assert.equal(isValidGuestInviteEmail(null), false);
}

testParseInviteLog();
testEmailValidation();
console.log("guest-registration-invite-email-log: ok");
