import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { confirmationCodesConflict } from "../../src/modules/airbnb-email/matching/confirmation-code-guard";
import { isPlausibleGuestName } from "../../src/modules/airbnb-email/parsing/guest-name-extract";

describe("confirmationCodesConflict", () => {
  it("no conflict when reservation has no code yet", () => {
    assert.equal(confirmationCodesConflict("HMCNCARK3K", null), false);
    assert.equal(confirmationCodesConflict("HMCNCARK3K", ""), false);
  });

  it("no conflict when email has no code", () => {
    assert.equal(confirmationCodesConflict(null, "HM4SPXSTS2"), false);
  });

  it("detects mismatch between email and reservation codes", () => {
    assert.equal(
      confirmationCodesConflict("HMCNCARK3K", "HM4SPXSTS2"),
      true,
    );
    assert.equal(
      confirmationCodesConflict("hm4spxsts2", "HM4SPXSTS2"),
      false,
    );
  });
});

describe("isPlausibleGuestName", () => {
  it("accepts real guest names including compound names", () => {
    assert.equal(isPlausibleGuestName("Karla Durán"), true);
    assert.equal(isPlausibleGuestName("Yuly Escarley Correa cordero"), true);
    assert.equal(isPlausibleGuestName("Maria del Carmen Rodriguez"), true);
  });

  it("rejects Airbnb instruction phrases from reminder emails", () => {
    assert.equal(
      isPlausibleGuestName("sabe cómo llegar al alojamiento."),
      false,
    );
    assert.equal(isPlausibleGuestName("consulta las instrucciones"), false);
    assert.equal(isPlausibleGuestName("puede acceder al alojamiento"), false);
    assert.equal(isPlausibleGuestName("llega mañana"), false);
  });

  it("rejects imperative-leading tokens", () => {
    assert.equal(isPlausibleGuestName("envía un mensaje a Jairo"), false);
    assert.equal(isPlausibleGuestName("asegúrate de que el viajero"), false);
  });
});
