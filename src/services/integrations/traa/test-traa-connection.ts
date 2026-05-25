import { decryptTTLockSecret } from "@/services/integrations/ttlock/ttlock-crypto";
import { testTraaApiConnection } from "./traa-api.client";
import { TraaHttpError } from "./traa-http";

export type TraaStoredCredentials = {
  clientId: string | null;
  apiKeyEncrypted: string | null;
  tokenEncrypted: string | null;
};

export type TraaConnectionTestOutcome = {
  ok: boolean;
  message: string;
};

function mapTraaHttpError(error: unknown): string {
  if (error instanceof TraaHttpError) {
    if (error.code === "TIMEOUT") {
      return "Tiempo de espera agotado al contactar TRAA. Intenta de nuevo.";
    }
    if (error.status) {
      return `${error.message} (HTTP ${error.status})`;
    }
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return "Error desconocido al probar TRAA";
}

function resolveTraaToken(row: TraaStoredCredentials): string | null {
  const fromToken = decryptTTLockSecret(row.tokenEncrypted);
  if (fromToken?.trim()) return fromToken.trim();
  const fromApiKey = decryptTTLockSecret(row.apiKeyEncrypted);
  if (fromApiKey?.trim()) return fromApiKey.trim();
  return null;
}

/**
 * Campos del formulario (sin cambiar UI):
 * - Client ID → número RNT del establecimiento
 * - Token → token PMS autogestionado (pms.mincit.gov.co/token)
 * - API Key → alternativa si el token se guardó en API Key
 */
export async function runTraaConnectionTest(
  row: TraaStoredCredentials,
): Promise<TraaConnectionTestOutcome> {
  const rnt = row.clientId?.trim() ?? "";
  const token = resolveTraaToken(row);

  if (!rnt || !token) {
    return {
      ok: false,
      message:
        "Configura Client ID (RNT) y Token TRAA (o API Key con el mismo token) antes de probar",
    };
  }

  try {
    const result = await testTraaApiConnection({ rnt, token });
    return { ok: result.ok, message: result.message };
  } catch (error) {
    return { ok: false, message: mapTraaHttpError(error) };
  }
}
