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
});
