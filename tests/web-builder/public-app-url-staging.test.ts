import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";

describe("getPublicAppUrl staging localhost", () => {
  const prev = {
    staging: process.env.PRAGMA_WEB_BUILDER_STAGING,
    app: process.env.APP_URL,
    nextApp: process.env.NEXT_PUBLIC_APP_URL,
    nodeEnv: process.env.NODE_ENV,
    vercel: process.env.VERCEL,
  };

  before(() => {
    const env = process.env as NodeJS.ProcessEnv & { NODE_ENV?: string };
    env.NODE_ENV = "development";
    delete env.VERCEL;
    env.PRAGMA_WEB_BUILDER_STAGING = "1";
    env.APP_URL = "http://localhost:3005";
    env.NEXT_PUBLIC_APP_URL = "http://localhost:3005";
  });

  after(() => {
    const env = process.env as NodeJS.ProcessEnv & { NODE_ENV?: string };
    for (const [key, value] of Object.entries({
      PRAGMA_WEB_BUILDER_STAGING: prev.staging,
      APP_URL: prev.app,
      NEXT_PUBLIC_APP_URL: prev.nextApp,
      NODE_ENV: prev.nodeEnv,
      VERCEL: prev.vercel,
    })) {
      if (value == null) delete env[key];
      else env[key] = value;
    }
  });

  it("keeps staging APP_URL on port 3005", async () => {
    const { getPublicAppUrl } = await import("@/lib/app-url");
    assert.equal(getPublicAppUrl(), "http://localhost:3005");
  });
});
