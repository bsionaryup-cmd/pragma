import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeReservationRevenueSources, resolveReservationRevenueAmount } from "@/lib/finance/reservation-revenue-amount";
import { resolveAuthoritativeHostPayout } from "@/lib/finance/resolve-authoritative-host-payout";
import { extractReservationFinancialSignals } from "@/modules/airbnb-email/parsing/reservation-financials-extract";

const ROBERTO_TEXT = `
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

const ROBERTO_HTML = `
<div>HMJDFHKS4R</div>
<div>Total (COP) $630.261,00</div>
<div>Cobro del anfitrión</div>
<div>Precio de la habitación por 4 noches $630.261,00</div>
<div>Comisión de servicio del anfitrión (15.5 % + IVA) -$116.249,86</div>
<div>Ganas $514.011,14</div>
`.trim();

const COMMISSION_SIGNALS = {
  hostPayoutAmount: 116249.86,
  grossAmount: 157565.25,
  guestTotalPaid: 157565.25,
  currency: "COP",
};

const KARLA_TEXT = `
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

const DUAL_FORWARD = `
---------- Forwarded message ---------
Reserva HM4SPXSTS2
${KARLA_TEXT}
---------- Forwarded message ---------
Reserva HMJDFHKS4R
${ROBERTO_TEXT}
`.trim();

function pickLatestRawEmail(
  audits: Array<{ processedAt: Date; rawEmail: { html?: string; text?: string } | null }>,
): { html?: string; text?: string } | null {
  const sorted = [...audits].sort(
    (a, b) => b.processedAt.getTime() - a.processedAt.getTime(),
  );
  return sorted[0]?.rawEmail ?? null;
}

describe("resolveAuthoritativeHostPayout degradación segura", () => {
  it("A: sin email y signals.hostPayoutAmount = comisión → null, nunca la comisión", () => {
    const resolved = resolveAuthoritativeHostPayout({
      payloadSignals: COMMISSION_SIGNALS,
    });
    assert.equal(resolved.hostPayoutAmount, null);
  });

  it("A: sin email ignora también enrichedFields.hostPayoutAmount", () => {
    const resolved = resolveAuthoritativeHostPayout({
      payloadSignals: COMMISSION_SIGNALS,
      enrichedFields: { hostPayoutAmount: 116249.86 },
    });
    assert.equal(resolved.hostPayoutAmount, null);
  });
  it("con text completo → usa Ganas del text y no la comisión persistida", () => {
    const resolved = resolveAuthoritativeHostPayout({
      confirmationCode: "HMJDFHKS4R",
      emailText: ROBERTO_TEXT,
      payloadSignals: COMMISSION_SIGNALS,
    });
    assert.equal(resolved.hostPayoutAmount, 514011.14);
  });

  it("B: sin email y con totalAmount iCal → finanzas usan totalAmount provisional", () => {
    const amount = resolveReservationRevenueAmount({
      totalAmount: 240638.36,
      payloadSignals: {
        hostPayoutAmount: 116249.86,
        grossAmount: 157565.25,
        guestTotalPaid: 157565.25,
      },
    });
    assert.equal(amount, 240638.36);
  });

  it("B: sin email ignora signals.hostPayoutAmount aunque parezca coherente", () => {
    const resolved = resolveAuthoritativeHostPayout({
      payloadSignals: {
        hostPayoutAmount: 116249.86,
        grossAmount: 157565.25,
        guestTotalPaid: 157565.25,
      },
    });
    assert.equal(resolved.hostPayoutAmount, null);
  });

  it("C: blob HTML truncado sin breakdown y comisión en señales → null, no comisión", () => {
    const truncatedHtmlBlob = "<table><tr><td>Reserva confirmada</td></tr></table>";
    const resolved = resolveAuthoritativeHostPayout({
      confirmationCode: "HMJDFHKS4R",
      emailMatchBlob: truncatedHtmlBlob,
      payloadSignals: {
        ...COMMISSION_SIGNALS,
        emailMatchBlob: truncatedHtmlBlob,
      },
    });
    assert.equal(resolved.hostPayoutAmount, null);
  });

  it("C: blob HTML truncado sin rawEmail.html → merge y drawer acuerdan en null", () => {
    const truncatedHtmlBlob = "<div><table><tr><td>Loft amplio 4P</td></tr></table></div>";
    const sources = {
      confirmationCode: "HMJDFHKS4R",
      emailMatchBlob: truncatedHtmlBlob,
      payloadSignals: {
        ...COMMISSION_SIGNALS,
        emailMatchBlob: truncatedHtmlBlob,
      },
    };
    const authoritative = resolveAuthoritativeHostPayout(sources);
    const merged = mergeReservationRevenueSources(sources);
    assert.equal(authoritative.hostPayoutAmount, null);
    assert.equal(merged.hostPayoutAmount, null);
  });

  it("D: múltiples audits → usa el rawEmail del audit más reciente", () => {
    const older = {
      processedAt: new Date("2026-06-01T10:00:00Z"),
      rawEmail: { text: "Ganas $1,00" },
    };
    const newer = {
      processedAt: new Date("2026-06-10T10:00:00Z"),
      rawEmail: { text: ROBERTO_TEXT },
    };
    const picked = pickLatestRawEmail([older, newer]);
    const resolved = resolveAuthoritativeHostPayout({
      confirmationCode: "HMJDFHKS4R",
      emailText: picked?.text ?? null,
      payloadSignals: COMMISSION_SIGNALS,
    });
    assert.equal(resolved.hostPayoutAmount, 514011.14);
  });

  it("E: sin confirmationCode y múltiples breakdowns → null", () => {
    const resolved = resolveAuthoritativeHostPayout({
      emailText: DUAL_FORWARD,
      payloadSignals: { emailMatchBlob: DUAL_FORWARD },
    });
    assert.equal(resolved.hostPayoutAmount, null);
    assert.equal(
      extractReservationFinancialSignals(DUAL_FORWARD).hostPayoutAmount,
      null,
    );
  });

  it("Finanzas y drawer comparten exactamente resolveAuthoritativeHostPayout", () => {
    const sources = {
      confirmationCode: "HMJDFHKS4R",
      emailHtml: ROBERTO_HTML,
      emailText: ROBERTO_TEXT,
      payloadSignals: COMMISSION_SIGNALS,
    };
    const authoritative = resolveAuthoritativeHostPayout(sources);
    const merged = mergeReservationRevenueSources(sources);
    assert.equal(merged.hostPayoutAmount, authoritative.hostPayoutAmount);
    assert.equal(merged.guestTotalPaid, authoritative.guestTotalPaid);
  });

  it("sin rawEmail.html pero con text → no depende del html", () => {
    const resolved = resolveAuthoritativeHostPayout({
      confirmationCode: "HMJDFHKS4R",
      emailText: ROBERTO_TEXT,
      emailHtml: null,
      payloadSignals: COMMISSION_SIGNALS,
    });
    assert.equal(resolved.hostPayoutAmount, 514011.14);
  });

  it("con html completo y sin text → usa html", () => {
    const resolved = resolveAuthoritativeHostPayout({
      confirmationCode: "HMJDFHKS4R",
      emailHtml: ROBERTO_HTML,
      payloadSignals: COMMISSION_SIGNALS,
    });
    assert.equal(resolved.hostPayoutAmount, 514011.14);
  });
});
