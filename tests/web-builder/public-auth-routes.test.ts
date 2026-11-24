import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();

describe("web-builder public auth routes", () => {
  it("keeps urbanovaloft and /login public; signs in via /sign-in", async () => {
    const proxy = await readFile(path.join(root, "src", "proxy.ts"), "utf8");
    assert.match(proxy, /"\/urbanovaloft"/);
    assert.match(proxy, /"\/login\(\.\*\)"/);
    assert.match(proxy, /new URL\("\/sign-in", request\.url\)/);
    assert.doesNotMatch(proxy, /await auth\.protect\(\)/);

    const loginAlias = await readFile(
      path.join(root, "src", "app", "(auth)", "login", "[[...rest]]", "page.tsx"),
      "utf8",
    );
    assert.match(loginAlias, /\/sign-in\?next=/);
    assert.match(loginAlias, /redirect_url/);
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
