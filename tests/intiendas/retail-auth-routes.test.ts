import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();

async function readSource(...segments: string[]) {
  return readFile(path.join(root, ...segments), "utf8");
}

describe("PRAGMA INTIENDAS auth routes (retired)", () => {
  it("redirects /intiendas login and app away from POS in proxy", async () => {
    const proxy = await readSource("src", "proxy.ts");

    assert.match(proxy, /INTIENDAS product retired/);
    assert.match(proxy, /\/intiendas\/login/);
    assert.match(proxy, /url\.pathname = "\/sign-in"/);
    assert.match(proxy, /url\.pathname = "\/panel"/);
    assert.match(proxy, /\/owner-dashboard\/intiendas/);
  });

  it("login page redirects to /sign-in", async () => {
    const loginPage = await readSource(
      "src",
      "app",
      "(retail)",
      "intiendas",
      "login",
      "page.tsx",
    );
    assert.match(loginPage, /redirect\("\/sign-in"\)/);
    assert.doesNotMatch(loginPage, /RetailPasswordSignInForm/);
  });

  it("does not divert PMS tenants to /intiendas from dashboard guards", async () => {
    const guards = await readSource(
      "src",
      "components",
      "platform",
      "platform-dashboard-guards.tsx",
    );
    assert.doesNotMatch(guards, /redirect\("\/intiendas\/dashboard"\)/);
  });
});
