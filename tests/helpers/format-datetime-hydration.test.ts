import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatDateTime } from "@/lib/helpers/date";

describe("formatDateTime hydration safety", () => {
  it("normalizes narrow no-break spaces in option-based formatting", () => {
    const sample = new Date("2026-05-23T20:55:00.000Z");
    const formatted = formatDateTime(sample, "—", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "America/Bogota",
    });

    assert.equal(formatted.includes("\u00a0"), false);
    assert.equal(formatted.includes("\u202f"), false);
    assert.match(formatted, /23\/05\/2026/);
  });

  it("uses stable default path for es-CO datetime", () => {
    const sample = new Date("2026-05-23T20:55:00.000Z");
    const formatted = formatDateTime(sample);
    assert.equal(formatted.includes("\u00a0"), false);
    assert.equal(formatted.includes("\u202f"), false);
  });
});
