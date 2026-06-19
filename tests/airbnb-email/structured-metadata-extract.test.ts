import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractGuestCountSignals } from "../../src/modules/airbnb-email/parsing/guest-count-extract";
import { extractReservationFinancialSignals } from "../../src/modules/airbnb-email/parsing/reservation-financials-extract";

describe("extractGuestCountSignals", () => {
  it("extrae línea de viajeros y normaliza categorías", () => {
    const signals = extractGuestCountSignals("Viajeros\n2 adultos, 1 niño, 1 mascota");
    assert.equal(signals.adultCount, 2);
    assert.equal(signals.childCount, 1);
    assert.equal(signals.petCount, 1);
    assert.equal(signals.guestCountTotal, 4);
  });

  it("soporta conteo genérico de huéspedes", () => {
    const signals = extractGuestCountSignals("Viajeros\n4 huéspedes");
    assert.equal(signals.adultCount, 4);
    assert.equal(signals.guestCountTotal, 4);
  });
});

describe("extractReservationFinancialSignals", () => {
  it("extrae total, moneda, ganancias y noches con labels", () => {
    const signals = extractReservationFinancialSignals(`
      Total (COP)
      $449.400,00

      Ganas
      $366.508,17

      3 noches
    `);
    assert.equal(signals.currency, "COP");
    assert.equal(signals.guestTotalPaid, 449400);
    assert.equal(signals.hostPayoutAmount, 366508.17);
    assert.equal(signals.nightCount, 3);
  });

  it("rechaza Ganas de otro forward cuando el total del huésped no cuadra", () => {
    const text = `
      Total (COP)
      $157.565,25
      Ganas
      $514.011,14
    `;
    const signals = extractReservationFinancialSignals(text);
    assert.equal(signals.guestTotalPaid, 157565.25);
    assert.equal(signals.hostPayoutAmount, null);
  });

  it("elige el Ganas del slice que contiene el código HM", () => {
    const html = `
      <div>Ganas $514.011,14 HMOOTHER123456</div>
      ---------- Forwarded message ---------
      <div>HMJDFHKS4R</div>
      <div>Total (COP) $157.565,25</div>
      <div>Ganas $128.432,10</div>
    `;
    const signals = extractReservationFinancialSignals("", {
      html,
      confirmationCode: "HMJDFHKS4R",
      checkIn: "2026-06-22",
      checkOut: "2026-06-26",
    });
    assert.equal(signals.guestTotalPaid, 157565.25);
    assert.equal(signals.hostPayoutAmount, 128432.1);
  });
});
