import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();

describe("web-builder public auth routes", () => {
  it("keeps urbanovaloft, /w/ sites and /login public; unified /login is canonical", async () => {
    const proxy = await readFile(path.join(root, "src", "proxy.ts"), "utf8");
    assert.match(proxy, /"\/urbanovaloft"/);
    assert.match(proxy, /"\/login\(\.\*\)"/);
    assert.match(proxy, /"\/api\/web-builder\(\.\*\)"/);
    assert.match(proxy, /isPublicTenantWebSitePath/);
    assert.match(proxy, /"\/stay\/\(\.\*\)"/);
    assert.match(proxy, /"\/guest-registration\/\(\.\*\)"/);
    assert.match(proxy, /new URL\(OWNER_LOGIN_PATH, request\.url\)/);
    assert.doesNotMatch(proxy, /await auth\.protect\(\)/);

    const loginPage = await readFile(
      path.join(root, "src", "app", "(auth)", "login", "page.tsx"),
      "utf8",
    );
    assert.match(loginPage, /EmailPasswordSignInForm/);

    const signInAlias = await readFile(
      path.join(root, "src", "app", "(auth)", "sign-in", "[[...sign-in]]", "page.tsx"),
      "utf8",
    );
    assert.match(signInAlias, /APP_LOGIN_PATH/);
  });

  it("soft-fails TTLock decrypt on auth-tag mismatch", async () => {
    const crypto = await readFile(
      path.join(root, "src", "services", "integrations", "ttlock", "ttlock-crypto.ts"),
      "utf8",
    );
    assert.match(crypto, /\[ttlock-crypto\] decrypt failed/);
    assert.match(crypto, /return null/);
  });
});
