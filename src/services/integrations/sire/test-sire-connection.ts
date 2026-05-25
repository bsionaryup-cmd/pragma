import {
  getSireDefaultDocumentType,
  resolveSireAuthMode,
} from "@/lib/integrations/sire-config";
import { decryptTTLockSecret, encryptTTLockSecret } from "@/services/integrations/ttlock/ttlock-crypto";
import { testSireApiConnection } from "./sire-api.client";
import { SireHttpError } from "./sire-http";
import { testSirePortalConnection } from "./sire-portal.client";

export type SireStoredCredentials = {
  clientId: string | null;
  callbackUrl: string | null;
  apiKeyEncrypted: string | null;
  clientSecretEncrypted: string | null;
  tokenEncrypted: string | null;
};

export type SireConnectionTestOutcome = {
  ok: boolean;
  message: string;
  /** Token de sesión OAuth o JSESSIONID cifrado para persistir tras éxito. */
  tokenToStore?: string | null;
};

function mapSireHttpError(error: unknown): string {
  if (error instanceof SireHttpError) {
    if (error.code === "TIMEOUT") {
      return "Tiempo de espera agotado al contactar SIRE. Intenta de nuevo.";
    }
    if (error.status) {
      return `${error.message} (HTTP ${error.status})`;
    }
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return "Error desconocido al probar SIRE";
}

/**
 * Campos del formulario (sin cambiar UI):
 * - Client ID → número de documento
 * - Client Secret → código tipo documento (ej. 10 = Cédula)
 * - API Key → contraseña portal SIRE
 * - Callback URL → ID empresa (`formLogin:listaEmpresa`)
 * - Token → reservado / grant password en modo API
 */
export async function runSireConnectionTest(
  row: SireStoredCredentials,
): Promise<SireConnectionTestOutcome> {
  const password = decryptTTLockSecret(row.apiKeyEncrypted);
  const documentNumber = row.clientId?.trim() ?? "";
  const documentType =
    decryptTTLockSecret(row.clientSecretEncrypted)?.trim() ||
    getSireDefaultDocumentType();
  const mode = resolveSireAuthMode();

  if (mode === "portal" && (!documentNumber || !password)) {
    return {
      ok: false,
      message:
        "Configura Client ID (número de documento) y API Key (contraseña SIRE) antes de probar",
    };
  }

  try {
    if (mode === "api") {
      const oauthClientId = row.clientId?.trim() ?? "";
      const clientSecret = decryptTTLockSecret(row.clientSecretEncrypted)?.trim();
      if (!oauthClientId || !clientSecret) {
        return {
          ok: false,
          message: "Client ID y Client Secret son obligatorios para SIRE API",
        };
      }
      const result = await testSireApiConnection({
        clientId: oauthClientId,
        clientSecret,
        apiKey: password,
        token: decryptTTLockSecret(row.tokenEncrypted),
      });
      if (!result.ok) return { ok: false, message: result.message };
      return {
        ok: true,
        message: result.message,
        tokenToStore: result.accessToken
          ? encryptTTLockSecret(result.accessToken)
          : null,
      };
    }

    if (!password) {
      return {
        ok: false,
        message:
          "Configura Client ID (número de documento) y API Key (contraseña SIRE) antes de probar",
      };
    }

    const portal = await testSirePortalConnection({
      documentType,
      documentNumber,
      password,
      companyId: row.callbackUrl,
    });
    if (!portal.ok) return { ok: false, message: portal.message };
    return {
      ok: true,
      message: portal.message,
      tokenToStore: portal.sessionCookie
        ? encryptTTLockSecret(portal.sessionCookie)
        : null,
    };
  } catch (error) {
    return { ok: false, message: mapSireHttpError(error) };
  }
}
