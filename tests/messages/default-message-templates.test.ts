import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_MESSAGE_TEMPLATES,
  DEFAULT_MESSAGE_TITLES,
  QUICK_MESSAGE_TYPE_ORDER,
  type QuickMessageType,
} from "@/lib/default-message-templates";

const REQUIRED_VARIABLES: Partial<Record<QuickMessageType, string[]>> = {
  WELCOME: ["{guestName}", "{propertyName}", "{stayRange}"],
  REGISTRATION: ["{guestName}", "{registrationLink}"],
  ACCESS: ["{guestName}", "{propertyName}", "{accessCode}"],
  CHECKOUT: ["{guestName}", "{propertyName}", "{checkOutTime}"],
};

describe("default message templates consistency", () => {
  it("each type has a unique title", () => {
    const titles = QUICK_MESSAGE_TYPE_ORDER.map((t) => DEFAULT_MESSAGE_TITLES[t]);
    assert.equal(new Set(titles).size, titles.length);
  });

  it("templates include required variables per type", () => {
    for (const [type, vars] of Object.entries(REQUIRED_VARIABLES) as [
      QuickMessageType,
      string[],
    ][]) {
      const body = DEFAULT_MESSAGE_TEMPLATES[type];
      for (const variable of vars) {
        assert.ok(
          body.includes(variable),
          `${type} should include ${variable}`,
        );
      }
    }
  });

  it("no template instructs guest to send access code before ACCESS message", () => {
    assert.equal(DEFAULT_MESSAGE_TEMPLATES.WELCOME.includes("{accessCode}"), false);
    assert.equal(DEFAULT_MESSAGE_TEMPLATES.REGISTRATION.includes("{accessCode}"), false);
  });

  it("HOUSE_RULES reinforces registered-guest policy without duplicating REGISTRATION body", () => {
    assert.match(
      DEFAULT_MESSAGE_TEMPLATES.HOUSE_RULES,
      /huéspedes registrados/i,
    );
    assert.equal(
      DEFAULT_MESSAGE_TEMPLATES.HOUSE_RULES.includes("{registrationLink}"),
      false,
    );
  });

  it("FOLLOW_UP is the only default template with wifi credentials", () => {
    const withWifi = QUICK_MESSAGE_TYPE_ORDER.filter((type) =>
      DEFAULT_MESSAGE_TEMPLATES[type].includes("{wifiPassword}"),
    );
    assert.deepEqual(withWifi, ["FOLLOW_UP"]);
  });
});
