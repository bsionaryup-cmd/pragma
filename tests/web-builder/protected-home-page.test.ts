import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isProtectedHomePageSlug,
  PROTECTED_HOME_PAGE_DELETE_MESSAGE,
} from "@/lib/web-builder/protected-home-page";

describe("protected home page slugs", () => {
  it("treats home and inicio as protected", () => {
    assert.equal(isProtectedHomePageSlug("home"), true);
    assert.equal(isProtectedHomePageSlug("inicio"), true);
    assert.equal(isProtectedHomePageSlug("HOME"), true);
    assert.equal(isProtectedHomePageSlug("Inicio"), true);
  });

  it("treats empty slug as protected", () => {
    assert.equal(isProtectedHomePageSlug(""), true);
    assert.equal(isProtectedHomePageSlug("   "), true);
  });

  it("allows other page slugs", () => {
    assert.equal(isProtectedHomePageSlug("ubicacion"), false);
    assert.equal(isProtectedHomePageSlug("contacto"), false);
  });

  it("exposes delete guard message", () => {
    assert.match(PROTECTED_HOME_PAGE_DELETE_MESSAGE, /ocultarla del sitio/i);
  });
});