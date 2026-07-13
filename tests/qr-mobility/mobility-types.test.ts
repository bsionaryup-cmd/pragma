import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatMobilityServiceCategory } from "@/features/qr-mobility/types/service";
import { formatMobilityAllyType } from "@/features/qr-mobility/types/ally";

describe("qr-mobility types", () => {
  it("formats service categories in Spanish", () => {
    assert.equal(formatMobilityServiceCategory("TRANSFER"), "Traslados");
    assert.equal(formatMobilityServiceCategory("TOUR"), "Tours");
    assert.equal(formatMobilityServiceCategory("EXPERIENCE"), "Experiencias");
    assert.equal(formatMobilityServiceCategory("RENTAL"), "Alquileres");
    assert.equal(formatMobilityServiceCategory("TICKET"), "Entradas");
    assert.equal(formatMobilityServiceCategory("OTHER"), "Otros");
  });

  it("formats ally types in Spanish", () => {
    assert.equal(formatMobilityAllyType("ACCOMMODATION"), "Alojamiento");
    assert.equal(formatMobilityAllyType("TRANSPORT"), "Transporte");
  });
});
