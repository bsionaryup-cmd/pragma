import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildMobilityPublicUrl,
  generateMobilityQrToken,
  slugifyAllyCode,
} from "@/lib/qr-mobility/mobility-qr-url";

describe("mobility-qr-url", () => {
  it("generateMobilityQrToken returns unique base64url strings", () => {
    const a = generateMobilityQrToken();
    const b = generateMobilityQrToken();
    assert.notEqual(a, b);
    assert.match(a, /^[A-Za-z0-9_-]+$/);
  });

  it("buildMobilityPublicUrl appends token to /m path", () => {
    const url = buildMobilityPublicUrl("abc123");
    assert.ok(url.endsWith("/m/abc123"));
  });

  it("slugifyAllyCode normalizes accents and adds suffix", () => {
    const code = slugifyAllyCode("Transporte Andrés");
    assert.match(code, /^TRANSPORTE-ANDRES-[A-F0-9]{6}$/);
  });
});
