import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("impersonation cookie", () => {
  it("round-trips session id with HMAC signature", async () => {
    process.env.PLATFORM_IMPERSONATION_SECRET =
      process.env.PLATFORM_IMPERSONATION_SECRET ||
      "test-impersonation-secret-for-unit";

    const {
      createImpersonationCookieValue,
      parseImpersonationCookieValue,
    } = await import("@/lib/platform/impersonation-cookie");

    const sessionId = "cm_test_impersonation_session_001";
    const raw = createImpersonationCookieValue(sessionId);
    assert.match(raw, /^cm_test_impersonation_session_001\.[0-9a-f]{64}$/);
    assert.equal(parseImpersonationCookieValue(raw), sessionId);
    assert.equal(parseImpersonationCookieValue(`${sessionId}.deadbeef`), null);
    assert.equal(parseImpersonationCookieValue(undefined), null);
  });
});

describe("platform owner API auth errors", () => {
  it("maps unauthorized/forbidden to HTTP statuses", async () => {
    const {
      PlatformOwnerUnauthorizedError,
      PlatformOwnerForbiddenError,
      platformOwnerErrorResponse,
    } = await import("@/lib/platform/require-platform-owner");

    const unauthorized = platformOwnerErrorResponse(
      new PlatformOwnerUnauthorizedError(),
    );
    assert.equal(unauthorized.status, 401);

    const forbidden = platformOwnerErrorResponse(
      new PlatformOwnerForbiddenError(),
    );
    assert.equal(forbidden.status, 403);

    const denied = platformOwnerErrorResponse(
      new Error("Acceso denegado: se requiere rol SUPER_ADMIN_OWNER"),
    );
    assert.equal(denied.status, 403);
  });
});
