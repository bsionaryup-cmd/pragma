import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeWebMediaUrl,
  webMediaUrlFingerprint,
} from "../../src/lib/web-builder/web-media-fingerprint";

describe("web media fingerprint", () => {
  it("normalizes host casing and trailing slashes", () => {
    const a = normalizeWebMediaUrl("HTTPS://Example.com/path/");
    const b = normalizeWebMediaUrl("https://example.com/path");
    assert.equal(a, b);
  });

  it("produces stable url fingerprints", () => {
    const fp1 = webMediaUrlFingerprint("https://cdn.test/a.jpg");
    const fp2 = webMediaUrlFingerprint("https://cdn.test/a.jpg");
    assert.equal(fp1, fp2);
  });
});