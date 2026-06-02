import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatNotificationEmailsForForm,
  isValidNotificationEmail,
  parsePropertyNotificationEmails,
} from "../../src/lib/property-notification-emails";

describe("property notification emails", () => {
  it("parses multiline and comma-separated input", () => {
    const emails = parsePropertyNotificationEmails(
      "admin@edificio.com\nrecepcion@edificio.com, otro@edificio.com",
    );
    assert.deepEqual(emails, [
      "admin@edificio.com",
      "recepcion@edificio.com",
      "otro@edificio.com",
    ]);
  });

  it("dedupes and normalizes case", () => {
    const emails = parsePropertyNotificationEmails([
      "Admin@Edificio.com",
      "admin@edificio.com",
      "RECEPCION@edificio.com",
    ]);
    assert.deepEqual(emails, ["admin@edificio.com", "recepcion@edificio.com"]);
  });

  it("rejects invalid addresses", () => {
    const emails = parsePropertyNotificationEmails(
      "not-an-email\nvalid@example.com",
    );
    assert.deepEqual(emails, ["valid@example.com"]);
  });

  it("returns empty list for blank input", () => {
    assert.deepEqual(parsePropertyNotificationEmails(""), []);
    assert.deepEqual(parsePropertyNotificationEmails(null), []);
  });

  it("formats stored json for the property form", () => {
    assert.equal(
      formatNotificationEmailsForForm(["a@b.com", "c@d.com"]),
      "a@b.com\nc@d.com",
    );
  });

  it("validates email shape", () => {
    assert.equal(isValidNotificationEmail("user@domain.co"), true);
    assert.equal(isValidNotificationEmail("bad"), false);
  });
});
