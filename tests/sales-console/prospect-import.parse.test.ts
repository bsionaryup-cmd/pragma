import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseProspectImportText } from "@/modules/sales-console/import/prospect-import.parse";

describe("parseProspectImportText", () => {
  it("parses a simple company list", () => {
    const result = parseProspectImportText("Empresa A\n\nEmpresa B\n");
    assert.equal(result.rows.length, 2);
    assert.equal(result.rows[0]?.companyName, "Empresa A");
    assert.equal(result.rows[1]?.companyName, "Empresa B");
    assert.equal(result.rows[0]?.phone, null);
  });

  it("parses pipe-delimited rows with header", () => {
    const result = parseProspectImportText(
      "Empresa | Teléfono | Website\nAcme PM | 3001234567 | https://acme.com",
    );
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0]?.companyName, "Acme PM");
    assert.equal(result.rows[0]?.phone, "3001234567");
    assert.equal(result.rows[0]?.website, "https://acme.com");
  });

  it("parses tab-delimited excel paste", () => {
    const result = parseProspectImportText("Empresa A\t3001\thttps://a.com\nEmpresa B\t3002\t");
    assert.equal(result.rows.length, 2);
    assert.equal(result.rows[1]?.website, null);
  });

  it("skips invalid rows without failing", () => {
    const result = parseProspectImportText("Empresa OK\n\n   \n");
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0]?.companyName, "Empresa OK");
  });
});
