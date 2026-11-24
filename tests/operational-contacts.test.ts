import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GUEST_REGISTRATION_LEGACY_CONTACT_KEY,
  guestRegistrationContactKeyFromFormValue,
  guestRegistrationContactKeyToFormValue,
  parseOperationalContacts,
  resolveGuestRegistrationAdminRecipients,
} from "../src/lib/operational-contacts";

describe("operational contacts", () => {
  it("parses and normalizes contacts", () => {
    const contacts = parseOperationalContacts([
      {
        key: "reception",
        name: "Recepción",
        role: "Recepción",
        email: " Admin@Edificio.COM ",
        whatsapp: "+57 300 123 4567",
        isActive: true,
      },
      { key: "", name: "x", role: "y" },
      null,
    ]);

    assert.equal(contacts.length, 1);
    assert.equal(contacts[0]?.email, "admin@edificio.com");
    assert.equal(contacts[0]?.whatsapp, "+57 300 123 4567");
  });

  it("prefers active operational contact email over legacy emails", () => {
    const resolution = resolveGuestRegistrationAdminRecipients({
      guestRegistrationContactKey: "reception",
      operationalContacts: [
        {
          key: "reception",
          name: "Recepción",
          role: "Recepción",
          email: "recepcion@edificio.com",
          whatsapp: null,
          isActive: true,
        },
      ],
      notificationEmails: ["legacy@edificio.com"],
    });

    assert.deepEqual(resolution.recipients, ["recepcion@edificio.com"]);
    assert.equal(resolution.source, "operational-contact");
    assert.equal(resolution.selectedContact?.key, "reception");
  });

  it("falls back to notificationEmails when contact missing or inactive", () => {
    const inactive = resolveGuestRegistrationAdminRecipients({
      guestRegistrationContactKey: "reception",
      operationalContacts: [
        {
          key: "reception",
          name: "Recepción",
          role: "Recepción",
          email: "recepcion@edificio.com",
          whatsapp: null,
          isActive: false,
        },
      ],
      notificationEmails: ["legacy@edificio.com"],
    });
    assert.deepEqual(inactive.recipients, ["legacy@edificio.com"]);
    assert.equal(inactive.source, "legacy-notification-emails");

    const legacyKey = resolveGuestRegistrationAdminRecipients({
      guestRegistrationContactKey: GUEST_REGISTRATION_LEGACY_CONTACT_KEY,
      operationalContacts: [
        {
          key: "reception",
          name: "Recepción",
          role: "Recepción",
          email: "recepcion@edificio.com",
          whatsapp: null,
          isActive: true,
        },
      ],
      notificationEmails: ["legacy@edificio.com"],
    });
    assert.deepEqual(legacyKey.recipients, ["legacy@edificio.com"]);
  });

  it("maps guest registration contact key form values", () => {
    assert.equal(
      guestRegistrationContactKeyToFormValue(null),
      GUEST_REGISTRATION_LEGACY_CONTACT_KEY,
    );
    assert.equal(
      guestRegistrationContactKeyFromFormValue(GUEST_REGISTRATION_LEGACY_CONTACT_KEY),
      null,
    );
    assert.equal(
      guestRegistrationContactKeyFromFormValue("reception"),
      "reception",
    );
  });
});
