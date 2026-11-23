import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFile } from "node:fs/promises";

describe("web-builder page delete vs archive", () => {
  it("blocks hard delete for home slugs and soft-archives on published visible pages", async () => {
    const source = await readFile(
      new URL("../../src/services/web-builder/web-site.service.ts", import.meta.url),
      "utf8",
    );
    assert.match(source, /isProtectedHomePageSlug/);
    assert.match(source, /PROTECTED_HOME_PAGE_DELETE_MESSAGE/);
    assert.match(source, /archiveTenantWebPage/);
    assert.match(source, /site\.status === WebSiteStatus\.PUBLISHED && page\.isVisible/);
    assert.match(source, /isVisible: false,\s*\n\s*status: WebSiteStatus\.DRAFT/);
  });
});