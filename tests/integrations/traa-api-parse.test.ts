import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildTraaAuthorizationHeader,
  extractTraaApiDetail,
  isTraaTokenAccepted,
  isTraaTokenRejected,
} from "../../src/services/integrations/traa/traa-api.client";

describe("traa-api.client", () => {
  it("formatea Authorization token según MINCIT", () => {
    assert.equal(buildTraaAuthorizationHeader("abc123"), "token abc123");
    assert.equal(buildTraaAuthorizationHeader("token xyz"), "token xyz");
  });

  it("detecta rechazo por token inválido", () => {
    const payload = { detail: "Token inválido." };
    assert.equal(isTraaTokenRejected(401, payload), true);
    assert.equal(isTraaTokenAccepted(401, payload), false);
  });

  it("acepta token cuando la API responde validación de campos", () => {
    const payload = { detail: "Campo requerido" };
    assert.equal(isTraaTokenRejected(400, payload), false);
    assert.equal(isTraaTokenAccepted(400, payload), true);
  });

  it("extrae detail de respuesta JSON", () => {
    assert.equal(
      extractTraaApiDetail({ detail: "Las credenciales de autenticación no se proveyeron." }),
      "Las credenciales de autenticación no se proveyeron.",
    );
  });
});
