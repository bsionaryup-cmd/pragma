import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";
import {
  CLERK_PROXY_PATH,
  isLocalHostname,
  normalizeClerkProxyPath,
  resolveClerkProviderProxyUrl,
  shouldProxyClerkFrontendApi,
} from "@/lib/auth/clerk-proxy-config";

function setNodeEnv(value: string | undefined) {
  Object.defineProperty(process.env, "NODE_ENV", {
    value,
    configurable: true,
    writable: true,
    enumerable: true,
  });
}

describe("clerk-proxy-config", () => {
  const prevNodeEnv = process.env.NODE_ENV;
  const prevProxyUrl = process.env.NEXT_PUBLIC_CLERK_PROXY_URL;

  afterEach(() => {
    setNodeEnv(prevNodeEnv);
    if (prevProxyUrl === undefined) {
      delete process.env.NEXT_PUBLIC_CLERK_PROXY_URL;
    } else {
      process.env.NEXT_PUBLIC_CLERK_PROXY_URL = prevProxyUrl;
    }
  });

  it("detects local hostnames", () => {
    assert.equal(isLocalHostname("localhost"), true);
    assert.equal(isLocalHostname("127.0.0.1"), true);
    assert.equal(isLocalHostname("::1"), true);
    assert.equal(isLocalHostname("www.pragmapms.com"), false);
    assert.equal(isLocalHostname("pragma-pms-git-main.vercel.app"), false);
  });

  it("normalizes proxy paths", () => {
    assert.equal(normalizeClerkProxyPath(""), CLERK_PROXY_PATH);
    assert.equal(normalizeClerkProxyPath("/__clerk"), "/__clerk");
    assert.equal(
      normalizeClerkProxyPath("https://www.pragmapms.com/__clerk"),
      "/__clerk",
    );
  });

  it("never proxies localhost in middleware", () => {
    setNodeEnv("production");
    process.env.NEXT_PUBLIC_CLERK_PROXY_URL = "/__clerk";
    assert.equal(
      shouldProxyClerkFrontendApi(new URL("http://localhost:3000/panel")),
      false,
    );
    assert.equal(
      shouldProxyClerkFrontendApi(
        new URL("http://127.0.0.1:3000/__clerk/v1/environment"),
      ),
      false,
    );
  });

  it("proxies production and preview hosts", () => {
    delete process.env.NEXT_PUBLIC_CLERK_PROXY_URL;
    setNodeEnv("production");
    assert.equal(
      shouldProxyClerkFrontendApi(new URL("https://www.pragmapms.com/panel")),
      true,
    );
    assert.equal(
      shouldProxyClerkFrontendApi(
        new URL("https://pragma-pms-git-fix.vercel.app/panel"),
      ),
      true,
    );
  });

  it("ClerkProvider proxyUrl is undefined in development", () => {
    setNodeEnv("development");
    process.env.NEXT_PUBLIC_CLERK_PROXY_URL = "/__clerk";
    assert.equal(resolveClerkProviderProxyUrl(), undefined);
  });

  it("ClerkProvider proxyUrl defaults to absolute www on Vercel production SSR", () => {
    setNodeEnv("production");
    delete process.env.NEXT_PUBLIC_CLERK_PROXY_URL;
    process.env.VERCEL = "1";
    assert.equal(
      resolveClerkProviderProxyUrl(),
      "https://www.pragmapms.com/__clerk",
    );
    delete process.env.VERCEL;
  });

  it("ClerkProvider proxyUrl keeps absolute env URLs", () => {
    setNodeEnv("production");
    process.env.NEXT_PUBLIC_CLERK_PROXY_URL =
      "https://www.pragmapms.com/__clerk";
    process.env.VERCEL = "1";
    assert.equal(
      resolveClerkProviderProxyUrl(),
      "https://www.pragmapms.com/__clerk",
    );
    delete process.env.VERCEL;
  });

  it("ClerkProvider proxyUrl expands relative env to absolute www on SSR", () => {
    setNodeEnv("production");
    process.env.NEXT_PUBLIC_CLERK_PROXY_URL = "/__clerk";
    process.env.VERCEL = "1";
    assert.equal(
      resolveClerkProviderProxyUrl(),
      "https://www.pragmapms.com/__clerk",
    );
    delete process.env.VERCEL;
  });

  it("ClerkProvider proxyUrl stays off for local next start SSR", () => {
    setNodeEnv("production");
    delete process.env.NEXT_PUBLIC_CLERK_PROXY_URL;
    delete process.env.VERCEL;
    assert.equal(resolveClerkProviderProxyUrl(), undefined);
  });
});
