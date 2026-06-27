import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveFinanceReservationRevenueAmount,
  resolveReservationRevenueAmount,
} from "@/lib/finance/reservation-revenue-amount";

describe("resolveReservationRevenueAmount", () => {
  it("sin email ignora enrichedFields.hostPayoutAmount y usa totalAmount iCal", () => {
    const amount = resolveReservationRevenueAmount({
      totalAmount: 247421,
      enrichedFields: { hostPayoutAmount: 1023779.89 },
    });
    assert.equal(amount, 247421);
  });

  it("uses stored totalAmount when no host payout in enrichment", () => {
    const amount = resolveReservationRevenueAmount({
      totalAmount: 250000,
      enrichedFields: { guestTotalPaid: 999 },
    });
    assert.equal(amount, 250000);
  });

  it("sin email ignora payload signals hostPayoutAmount y cae a totalAmount", () => {
    const amount = resolveReservationRevenueAmount({
      totalAmount: 250000,
      payloadSignals: {
        hostPayoutAmount: 116249.86,
        grossAmount: 157565.25,
        netPayout: 0,
      },
    });
    assert.equal(amount, 250000);
  });

  it("sin email ni totalAmount devuelve 0 en lugar de comisión en signals", () => {
    const amount = resolveReservationRevenueAmount({
      totalAmount: 0,
      payloadSignals: {
        hostPayoutAmount: 116249.86,
        grossAmount: 157565.25,
        netPayout: 0,
      },
    });
    assert.equal(amount, 0);
  });

  it("prefers validated Ganas from blob over commission stored in signals", () => {
    const amount = resolveReservationRevenueAmount({
      totalAmount: 116249.86,
      payloadSignals: {
        hostPayoutAmount: 116249.86,
        grossAmount: 157565.25,
        guestTotalPaid: 157565.25,
        emailMatchBlob:
          "Total (COP) $630.261,00\nCobro del anfitrión\nPrecio de la habitación por 4 noches\n$630.261,00\nComisión de servicio del anfitrión (15.5 % + IVA)\n-$116.249,86\nGanas\n$514.011,14",
      },
    });
    assert.equal(amount, 514011.14);
  });

  it("rejects incoherent host payout against gross when blob lacks breakdown", () => {
    const amount = resolveReservationRevenueAmount({
      totalAmount: 0,
      payloadSignals: {
        hostPayoutAmount: 514011.14,
        grossAmount: 157565.25,
        netPayout: 0,
      },
    });
    assert.equal(amount, 0);
  });

  it("extracts host payout from Airbnb email blob (Ganas)", () => {
    const amount = resolveReservationRevenueAmount({
      totalAmount: 0,
      emailMatchBlob:
        "Total (COP) $630.261,00\nCobro del anfitrión\nPrecio de la habitación por 4 noches\n$630.261,00\nComisión de servicio del anfitrión (15.5 % + IVA)\n-$116.249,86\nGanas\n$514.011,14",
    });
    assert.equal(amount, 514011.14);
  });

  it("counts finance revenue from email payout when breakdown is present", () => {
    const amount = resolveFinanceReservationRevenueAmount(
      {
        platform: "AIRBNB",
        totalAmount: 0,
        icalUid: "ical-uid",
        reservationCode: null,
      },
      {
        emailMatchBlob:
          "Total (COP) $449.400,00\nGanas\n$366.508,17\nCobro del anfitrión\nPrecio de la habitación\n$449.400,00\nComisión de servicio del anfitrión\n-$82.891,83",
        payloadSignals: { hostPayoutAmount: 82891.83 },
      },
    );
    assert.equal(amount, 366508.17);
  });

  it("falls back to stored totalAmount when email exists but payout is unparseable", () => {
    const amount = resolveReservationRevenueAmount({
      totalAmount: 333422,
      emailHtml: "<html>confirmed reservation</html>",
    });
    assert.equal(amount, 333422);
  });
});
