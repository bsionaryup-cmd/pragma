import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isGuestPaymentLinkedOtherIncome,
  partitionOtherIncomes,
} from "@/lib/finance/other-income-policy";

describe("other income policy", () => {
  it("detects guest payment mirror rows by link suffix", () => {
    assert.equal(
      isGuestPaymentLinkedOtherIncome("Depósito de seguridad · link:clxyz123abc"),
      true,
    );
    assert.equal(
      isGuestPaymentLinkedOtherIncome("Ingreso manual de limpieza"),
      false,
    );
    assert.equal(isGuestPaymentLinkedOtherIncome(null), false);
    assert.equal(isGuestPaymentLinkedOtherIncome(""), false);
  });

  it("partitions operational vs guest payment mirror incomes", () => {
    const rows = [
      { id: "1", description: "Propina · link:abc", amount: 50 },
      { id: "2", description: "Reembolso", amount: 100 },
    ];
    const { operational, guestPaymentMirror } = partitionOtherIncomes(rows);
    assert.equal(operational.length, 1);
    assert.equal(operational[0]?.id, "2");
    assert.equal(guestPaymentMirror.length, 1);
    assert.equal(guestPaymentMirror[0]?.id, "1");
  });
});
