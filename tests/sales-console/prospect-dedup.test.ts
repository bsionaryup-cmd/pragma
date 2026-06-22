import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildProspectDedupKey, filterProspectsForInsert } from "../../src/modules/sales-console/prospecting/prospect-dedup";

describe("prospect dedup key", () => {
  it("normalizes case and whitespace", () => {
    const left = buildProspectDedupKey({
      companyName: "  Apartamentos   Poblado ",
      city: " Medellín ",
    });
    const right = buildProspectDedupKey({
      companyName: "apartamentos poblado",
      city: "medellín",
    });
    assert.equal(left, right);
  });

  it("treats empty city consistently", () => {
    const withNull = buildProspectDedupKey({ companyName: "CoHost", city: null });
    const withEmpty = buildProspectDedupKey({ companyName: "CoHost", city: "" });
    assert.equal(withNull, withEmpty);
  });

  it("differentiates companies in the same city", () => {
    const a = buildProspectDedupKey({ companyName: "Alpha PM", city: "Bogotá" });
    const b = buildProspectDedupKey({ companyName: "Beta PM", city: "Bogotá" });
    assert.notEqual(a, b);
  });

  it("skips duplicates within the same batch and against existing keys", () => {
    const existing = new Set([buildProspectDedupKey({ companyName: "Existing Co", city: "Medellín" })]);
    const candidates = [
      { companyName: "Existing Co", city: "Medellín" },
      { companyName: "New Co", city: "Medellín" },
      { companyName: "New Co", city: "Medellín" },
    ];

    const result = filterProspectsForInsert(candidates, existing);
    assert.equal(result.rows.length, 1);
    assert.equal(result.skippedDuplicate, 2);
    assert.equal(result.rows[0]?.companyName, "New Co");
  });
});
