import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();

async function readSource(...segments: string[]) {
  return readFile(path.join(root, ...segments), "utf8");
}

describe("PRAGMA INTIENDAS auth routes", () => {
  it("keeps the login route public and protects the retail route family", async () => {
    const proxy = await readSource("src", "proxy.ts");

    assert.match(proxy, /const isRetailRoute = createRouteMatcher\(\["\/intiendas\(\.\*\)"\]\)/);
    assert.match(proxy, /"\/intiendas\/login"/);
    assert.match(proxy, /if \(isRetailRoute\(request\)\)/);
    assert.match(proxy, /new URL\("\/intiendas\/login", request\.url\)/);
  });

  it("only redirects authenticated retail users with an active tenant", async () => {
    const loginPage = await readSource(
      "src",
      "app",
      "(retail)",
      "intiendas",
      "login",
      "page.tsx",
    );
    const retailGuard = await readSource(
      "src",
      "domains",
      "retail",
      "auth",
      "require-retail-context.ts",
    );

    assert.match(loginPage, /getUserByClerkId\(userId\)/);
    assert.match(loginPage, /dbUser\.organizationId/);
    assert.match(loginPage, /\/intiendas\/dashboard/);
    assert.match(loginPage, /ClerkSignOutButton/);
    assert.match(loginPage, /store_inactive/);
    assert.match(loginPage, /no_org/);
    assert.match(loginPage, /RetailPasswordSignInForm/);
    assert.doesNotMatch(loginPage, /EmailPasswordSignInForm/);
    assert.doesNotMatch(loginPage, /organización asignada/i);

    const retailAuth = await readSource(
      "src",
      "domains",
      "retail",
      "services",
      "retail-auth.service.ts",
    );
    assert.match(retailAuth, /createSignInToken/);
    assert.match(retailAuth, /verifyPassword/);
    assert.doesNotMatch(retailAuth, /from "@\/lib\/auth"/);

    assert.match(retailGuard, /getUserByClerkId\(userId\)/);
    assert.match(retailGuard, /findStoreForOrg/);
    assert.doesNotMatch(retailGuard, /getOrCreateStoreForOrg/);
    assert.match(retailGuard, /\/intiendas\/login/);
    assert.doesNotMatch(retailGuard, /from "@\/lib\/auth"/);
    assert.doesNotMatch(retailGuard, /redirect\("\/sign-in/);
  });
});
