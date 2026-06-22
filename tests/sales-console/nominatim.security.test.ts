import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertNominatimRequestUrl,
  buildNominatimSearchUrl,
  NOMINATIM_ALLOWED_HOST,
} from "@/modules/sales-console/discovery/nominatim.security";

describe("nominatim security", () => {
  it("allows only the OpenStreetMap nominatim host", () => {
    const url = buildNominatimSearchUrl("administración de propiedades Medellín", 25);
    assert.equal(url.hostname, NOMINATIM_ALLOWED_HOST);
    assert.equal(url.searchParams.get("countrycodes"), "co");
    assert.equal(url.searchParams.get("limit"), "25");
  });

  it("rejects non-allowlisted hosts", () => {
    assert.throws(() => {
      assertNominatimRequestUrl(new URL("https://evil.example.com/search?q=test"));
    });
  });

  it("rejects non-https requests", () => {
    assert.throws(() => {
      assertNominatimRequestUrl(
        new URL("http://nominatim.openstreetmap.org/search?q=test"),
      );
    });
  });

  it("caps result limit at 25", () => {
    const url = buildNominatimSearchUrl("hotel bogota", 100);
    assert.equal(url.searchParams.get("limit"), "25");
  });
});
