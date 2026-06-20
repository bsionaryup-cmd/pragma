import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractReservationSignals } from "@/modules/airbnb-email/parsing/extractors";
import { extractReservationFinancialSignals } from "@/modules/airbnb-email/parsing/reservation-financials-extract";
import { resolveAuthoritativeHostPayout } from "@/lib/finance/resolve-authoritative-host-payout";
import { resolveReservationRevenueAmount } from "@/lib/finance/reservation-revenue-amount";

const ROBERTO_BLOB = `
El viajero ha pagado
$157.565,25 por 4 noches
$630.261,00
Comisión de servicio del viajero
$0,00
Total (COP)
$630.261,00
Cobro del anfitrión
Precio de la habitación por 4 noches
$630.261,00
Comisión de servicio del anfitrión (15.5 % + IVA)
-$116.249,86
Ganas
$514.011,14
`.trim();

const KARLA_BLOB = `
El viajero ha pagado
$247.421,00 por 4 noches
$989.684,00
Comisión de servicio del viajero
$0,00
Total (COP)
$989.684,00
Cobro del anfitrión
Precio de la habitación por 4 noches
$989.684,00
Comisión de servicio del anfitrión (15.5 % + IVA)
-$182.546,17
Ganas
$807.137,83
`.trim();

const DUAL_FORWARD_BLOB = `
---------- Forwarded message ---------
Reserva confirmada HM4SPXSTS2
${KARLA_BLOB}
---------- Forwarded message ---------
Reserva confirmada HMJDFHKS4R
${ROBERTO_BLOB}
`.trim();

describe("real Airbnb confirmation financials", () => {
  it("Roberto HMJDFHKS4R: usa Ganas y Total (COP), no la comisión", () => {
    const signals = extractReservationFinancialSignals(ROBERTO_BLOB, {
      confirmationCode: "HMJDFHKS4R",
    });
    assert.equal(signals.guestTotalPaid, 630261);
    assert.equal(signals.hostPayoutAmount, 514011.14);

    const resolved = resolveReservationRevenueAmount({
      totalAmount: 116249.86,
      confirmationCode: "HMJDFHKS4R",
      payloadSignals: {
        hostPayoutAmount: 116249.86,
        grossAmount: 157565.25,
        guestTotalPaid: 157565.25,
        emailMatchBlob: ROBERTO_BLOB,
      },
    });
    assert.equal(resolved, 514011.14);
  });

  it("Karla HM4SPXSTS2: usa Ganas y Total (COP), no la comisión", () => {
    const signals = extractReservationFinancialSignals(KARLA_BLOB, {
      confirmationCode: "HM4SPXSTS2",
    });
    assert.equal(signals.guestTotalPaid, 989684);
    assert.equal(signals.hostPayoutAmount, 807137.83);

    const resolved = resolveReservationRevenueAmount({
      totalAmount: 1023779.89,
      confirmationCode: "HM4SPXSTS2",
      payloadSignals: {
        hostPayoutAmount: 182546.17,
        grossAmount: 247421,
        guestTotalPaid: 247421,
        emailMatchBlob: KARLA_BLOB,
      },
    });
    assert.equal(resolved, 807137.83);
  });

  it("forward con dos reservas completas no mezcla Ganas entre códigos HM", () => {
    const roberto = extractReservationFinancialSignals(DUAL_FORWARD_BLOB, {
      confirmationCode: "HMJDFHKS4R",
    });
    const karla = extractReservationFinancialSignals(DUAL_FORWARD_BLOB, {
      confirmationCode: "HM4SPXSTS2",
    });

    assert.equal(roberto.hostPayoutAmount, 514011.14);
    assert.equal(karla.hostPayoutAmount, 807137.83);
    assert.notEqual(roberto.hostPayoutAmount, karla.hostPayoutAmount);

    const robertoResolved = resolveAuthoritativeHostPayout({
      confirmationCode: "HMJDFHKS4R",
      emailMatchBlob: DUAL_FORWARD_BLOB,
      payloadSignals: {
        hostPayoutAmount: 116249.86,
        guestTotalPaid: 157565.25,
        emailMatchBlob: DUAL_FORWARD_BLOB,
      },
    });
    const karlaResolved = resolveAuthoritativeHostPayout({
      confirmationCode: "HM4SPXSTS2",
      emailMatchBlob: DUAL_FORWARD_BLOB,
      payloadSignals: {
        hostPayoutAmount: 182546.17,
        guestTotalPaid: 247421,
        emailMatchBlob: DUAL_FORWARD_BLOB,
      },
    });

    assert.equal(robertoResolved.hostPayoutAmount, 514011.14);
    assert.equal(karlaResolved.hostPayoutAmount, 807137.83);
  });

  it("sin confirmationCode y múltiples breakdowns devuelve null en hostPayout", () => {
    const signals = extractReservationFinancialSignals(DUAL_FORWARD_BLOB);
    assert.equal(signals.hostPayoutAmount, null);
  });

  it("extractReservationSignals conserva Ganas en señales financieras", () => {
    const signals = extractReservationSignals({
      subject: "Reserva confirmada: Roberto Gonzalez Morales llega el 22 jun. HMJDFHKS4R",
      body: ROBERTO_BLOB,
      html: null,
    });
    assert.equal(signals.guestTotalPaid, 630261);
    assert.equal(signals.hostPayoutAmount, 514011.14);
    assert.equal(signals.grossAmount, 630261);
  });
});
