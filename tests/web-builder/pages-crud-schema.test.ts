import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { WebSiteStatus } from "@prisma/client";
import {
  createWebPageSchema,
  updateWebPageSchema,
  deleteWebPageSchema,
} from "@/features/web-builder/schemas/web-builder.schema";

describe("web-builder pages CRUD schemas", () => {
  it("accepts create payload", () => {
    const parsed = createWebPageSchema.safeParse({
      slug: "ubicacion",
      title: "Ubicación",
      body: "Texto",
      sortOrder: 10,
      isVisible: true,
    });
    assert.equal(parsed.success, true);
  });

  it("rejects invalid page slug", () => {
    const parsed = createWebPageSchema.safeParse({
      slug: "Bad Slug!",
      title: "X",
    });
    assert.equal(parsed.success, false);
  });

  it("accepts update and delete ids", () => {
    const valid = "cmwsyl5yc0000uotyy0h5yk8z";
    assert.equal(updateWebPageSchema.safeParse({ pageId: valid, title: "A" }).success, true);
    assert.equal(deleteWebPageSchema.safeParse({ pageId: valid }).success, true);
    assert.equal(deleteWebPageSchema.safeParse({ pageId: "not-a-cuid" }).success, false);
  });

  it("accepts page publish status DRAFT or PUBLISHED only", () => {
    const valid = "cmwsyl5yc0000uotyy0h5yk8z";
    assert.equal(
      updateWebPageSchema.safeParse({
        pageId: valid,
        status: WebSiteStatus.PUBLISHED,
      }).success,
      true,
    );
    assert.equal(
      updateWebPageSchema.safeParse({
        pageId: valid,
        status: WebSiteStatus.DRAFT,
      }).success,
      true,
    );
    assert.equal(
      updateWebPageSchema.safeParse({
        pageId: valid,
        status: WebSiteStatus.IN_REVIEW,
      }).success,
      false,
    );
  });
});

