import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clientUatCookieNamesFromHeader,
  clientUatExpireTargets,
  resolveIncompleteSessionBridge,
} from "../../src/lib/auth/clerk-incomplete-session-bridge";
import { APP_LOGIN_PATH, APP_SIGNED_OUT_LOGIN_PATH } from "../../src/lib/auth/auth-paths";

describe("resolveIncompleteSessionBridge", () => {
  it("redirects protected /panel to unified /login settle-bridge", () => {
    const d = resolveIncompleteSessionBridge("/panel", "");
    assert.equal(d.action, "redirect");
    if (d.action !== "redirect") return;
    assert.equal(d.marker, "settle-bridge");
    assert.equal(d.loginPath, APP_LOGIN_PATH);
    assert.equal(d.nextPath, "/panel");
    assert.equal(d.redirectParam, "redirect_url");
  });

  it("pass-through on /login to break ERR_TOO_MANY_REDIRECTS self-loop", () => {
    const d = resolveIncompleteSessionBridge(
      "/login",
      "?redirect_url=%2Fpanel",
    );
    assert.deepEqual(d, {
      action: "pass-through",
      marker: "auth-surface-pass",
    });
  });

  it("pass-through on legacy /sign-in, /owner-login and /auth/continue", () => {
    assert.equal(
      resolveIncompleteSessionBridge("/sign-in", "?redirect_url=%2Fpanel")
        .action,
      "pass-through",
    );
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

  it("uses unified /login for owner-dashboard paths", () => {
    const d = resolveIncompleteSessionBridge("/owner-dashboard", "");
    assert.equal(d.action, "redirect");
    if (d.action !== "redirect") return;
    assert.equal(d.loginPath, APP_LOGIN_PATH);
    assert.equal(d.redirectParam, "redirect_url");
  });
});

describe("auth path contract", () => {
  it("signed-out login includes signed_out=1", () => {
    assert.equal(APP_SIGNED_OUT_LOGIN_PATH, "/login?signed_out=1");
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
