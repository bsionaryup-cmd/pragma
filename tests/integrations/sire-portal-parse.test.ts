import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isSirePortalLoginSuccess,
  parseSirePortalLoginError,
} from "../../src/services/integrations/sire/sire-portal.client";

describe("parseSirePortalLoginError", () => {
  it("extrae rich-messages-label del HTML de error", () => {
    const html = `<span class="rich-messages-label">Informaci&oacute;n de usuario o contrase&ntilde;a no corresponden.</span>`;
    const msg = parseSirePortalLoginError(html);
    assert.ok(msg?.includes("contrase"));
  });

  it("detecta fallo cuando sigue el formulario de login", () => {
    const html = `<form id="formLogin"><input id="formLogin:password" /></form>`;
    const response = new Response(html, { status: 200 });
    assert.equal(isSirePortalLoginSuccess(response, html), false);
  });
});
