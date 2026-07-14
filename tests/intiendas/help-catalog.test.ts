import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HELP_ARTICLES,
  HELP_ROUTE_AUDIT,
  getHelpArticle,
  searchHelpArticles,
} from "@/domains/retail/help/catalog";

describe("INTIENDAS help catalog SSOT", () => {
  it("documents only audited routes with matching articles", () => {
    for (const row of HELP_ROUTE_AUDIT) {
      assert.ok(getHelpArticle(row.articleSlug), `missing article for ${row.path}`);
    }
  });

  it("has unique slugs", () => {
    const slugs = HELP_ARTICLES.map((a) => a.slug);
    assert.equal(new Set(slugs).size, slugs.length);
  });

  it("searches by button and keyword", () => {
    const byButton = searchHelpArticles("Abrir caja");
    assert.ok(byButton.some((a) => a.slug === "abrir-cerrar-caja"));
    const byKw = searchHelpArticles("whatsapp");
    assert.ok(byKw.some((a) => a.slug === "abastecimiento" || a.slug === "proveedores"));
  });

  it("keeps related slug references resolvable", () => {
    for (const article of HELP_ARTICLES) {
      for (const related of article.relatedSlugs) {
        assert.ok(getHelpArticle(related), `${article.slug} → ${related}`);
      }
    }
  });
});
