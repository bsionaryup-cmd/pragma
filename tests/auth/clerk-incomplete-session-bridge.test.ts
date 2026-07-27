import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clientUatCookieNamesFromHeader,
  clientUatExpireTargets,
  resolveIncompleteSessionBridge,
} from "../../src/lib/auth/clerk-incomplete-session-bridge";

describe("resolveIncompleteSessionBridge", () => {
  it("redirects protected /panel to sign-in settle-bridge", () => {
    const d = resolveIncompleteSessionBridge("/panel", "");
    assert.equal(d.action, "redirect");
    if (d.action !== "redirect") return;
    assert.equal(d.marker, "settle-bridge");
    assert.equal(d.loginPath, "/sign-in");
    assert.equal(d.nextPath, "/panel");
    assert.equal(d.redirectParam, "redirect_url");
  });

  it("pass-through on /sign-in to break ERR_TOO_MANY_REDIRECTS self-loop", () => {
    const d = resolveIncompleteSessionBridge(
      "/sign-in",
      "?redirect_url=%2Fpanel",
    );
    assert.deepEqual(d, {
      action: "pass-through",
      marker: "auth-surface-pass",
    });
  });

  it("pass-through on /owner-login and /auth/continue", () => {
    assert.equal(
      resolveIncompleteSessionBridge("/owner-login", "?next=%2Fowner-dashboard")
        .action,
      "pass-through",
    );
    assert.equal(
      resolveIncompleteSessionBridge("/auth/continue", "?next=%2Fpanel").action,
      "pass-through",
    );
  });

  it("uses owner-login for owner-dashboard paths", () => {
    const d = resolveIncompleteSessionBridge("/owner-dashboard", "");
    assert.equal(d.action, "redirect");
    if (d.action !== "redirect") return;
    assert.equal(d.loginPath, "/owner-login");
    assert.equal(d.redirectParam, "next");
  });
});

describe("clientUatExpireTargets", () => {
  it("includes apex domain for www host", () => {
    const targets = clientUatExpireTargets("www.pragmapms.com");
    assert.ok(targets.some((t) => t.name === "__client_uat" && !t.domain));
    assert.ok(
      targets.some(
        (t) => t.name === "__client_uat" && t.domain === "pragmapms.com",
      ),
    );
  });
});

describe("clientUatCookieNamesFromHeader", () => {
  it("includes suffixed uat names from the jar", () => {
    const names = clientUatCookieNamesFromHeader(
      "__client_uat=1; __client_uat_abc=1; other=x",
    );
    assert.ok(names.includes("__client_uat"));
    assert.ok(names.includes("__client_uat_abc"));
    assert.ok(!names.includes("other"));
  });
});
