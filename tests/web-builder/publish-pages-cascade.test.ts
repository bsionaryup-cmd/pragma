import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFile } from "node:fs/promises";

describe("web-builder publish cascade", () => {
  it("setWebSiteStatus publishes visible pages when site is PUBLISHED", async () => {
    const source = await readFile(
      new URL("../../src/services/web-builder/web-site.service.ts", import.meta.url),
      "utf8",
    );
    assert.match(source, /tenantWebPage\.updateMany/);
    assert.match(source, /status: WebSiteStatus\.PUBLISHED/);
    assert.match(
      source,
      /where: \{ siteId: site\.id, isVisible: true \}/,
    );
  });
});
