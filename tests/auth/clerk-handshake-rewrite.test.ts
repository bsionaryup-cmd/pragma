import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rewriteClerkFapiHandshakeLocationUrl } from "@/lib/auth/clerk-handshake-rewrite";
import { buildAuthContinuePath } from "@/lib/auth/post-auth-paths";

describe("clerk handshake rewrite", () => {
  it("rewrites clerk.pragmapms.com handshake onto /__clerk", () => {
    const out = rewriteClerkFapiHandshakeLocationUrl(
      "https://clerk.pragmapms.com/v1/client/handshake?redirect_url=https%3A%2F%2Fwww.pragmapms.com%2Fpanel&__clerk_handshake_reason=client-uat-but-no-session-token",
      "https://www.pragmapms.com",
    );
    assert.ok(out);
    const url = new URL(out!);
    assert.equal(url.origin, "https://www.pragmapms.com");
    assert.equal(url.pathname, "/__clerk/v1/client/handshake");
    assert.match(url.search, /redirect_url=/);
  });

  it("does not rewrite same-origin /__clerk locations", () => {
    const out = rewriteClerkFapiHandshakeLocationUrl(
      "https://www.pragmapms.com/__clerk/v1/client/handshake?x=1",
      "https://www.pragmapms.com",
    );
    assert.equal(out, null);
  });

  it("does not rewrite app redirects to /sign-in", () => {
    const out = rewriteClerkFapiHandshakeLocationUrl(
      "https://www.pragmapms.com/sign-in?redirect_url=%2Fpanel",
      "https://www.pragmapms.com",
    );
    assert.equal(out, null);
  });

  it("buildAuthContinuePath encodes next", () => {
    assert.equal(
      buildAuthContinuePath("/panel"),
      "/auth/continue?next=%2Fpanel",
    );
  });
});
