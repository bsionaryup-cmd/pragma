import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { refreshAuditSignalsFromRaw } from "@/modules/airbnb-email/repair/refresh-audit-signals-from-raw";

describe("refreshAuditSignalsFromRaw", () => {
  it("re-parses raw html when stored net payout is zero but host payout exists", () => {
    const rawEmail = {
      subject: "Fwd: Reserva confirmada: Milena Mercedes Barrero Cortes",
      text: "",
      html: `
        Cobro del anfitrión
        Precio de la habitación por 3 noches
        $449.400,00
        Ganas
        $366.508,17
      `,
    };
    const parsedPayload = {
      signals: {
        confirmationCode: "HMYZWPD95M",
        netPayout: 0,
        hostPayoutAmount: null,
      },
    };

    const refreshed = refreshAuditSignalsFromRaw({
      parsedPayload,
      rawEmail,
      subject: rawEmail.subject,
    });

    assert.equal(refreshed?.confirmationCode, "HMYZWPD95M");
    assert.equal(refreshed?.hostPayoutAmount, 366508.17);
  });
});
