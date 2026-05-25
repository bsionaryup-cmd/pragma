import {
  getSireApiBaseUrl,
  getSireApiTestPath,
  getSireApiTokenPath,
} from "@/lib/integrations/sire-config";
import { sireFetch, SireHttpError } from "./sire-http";

export type SireApiCredentials = {
  clientId: string;
  clientSecret: string;
  apiKey?: string | null;
  token?: string | null;
};

export type SireApiTestResult =
  | { ok: true; accessToken?: string; message: string }
  | { ok: false; message: string };

function buildFormBody(entries: Record<string, string>): string {
  return new URLSearchParams(entries).toString();
}

function extractApiError(payload: unknown, status: number): string {
  if (!payload || typeof payload !== "object") {
    return `SIRE API error (HTTP ${status})`;
  }
  const record = payload as Record<string, unknown>;
  const message =
    (typeof record.error_description === "string"
      ? record.error_description
      : null) ||
    (typeof record.message === "string" ? record.message : null) ||
    (typeof record.error === "string" ? record.error : null);
  return message ?? `SIRE API error (HTTP ${status})`;
}

async function requestOAuthToken(
  baseUrl: string,
  credentials: SireApiCredentials,
): Promise<{ accessToken: string; raw: Record<string, unknown> }> {
  const tokenPath = getSireApiTokenPath();
  const tokenUrl = `${baseUrl}${tokenPath}`;

  const grantType = process.env.SIRE_API_GRANT_TYPE?.trim() || "client_credentials";
  const body: Record<string, string> = {
    grant_type: grantType,
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
  };

  if (grantType === "password") {
    const username =
      credentials.apiKey?.trim() || process.env.SIRE_API_USERNAME?.trim();
    const password =
      credentials.token?.trim() || process.env.SIRE_API_PASSWORD?.trim();
    if (!username || !password) {
      throw new SireHttpError(
        "SIRE API (password): API Key = usuario y Token = contraseña, o define SIRE_API_USERNAME / SIRE_API_PASSWORD",
        "PARSE",
      );
    }
    body.username = username;
    body.password = password;
  }

  const scope = process.env.SIRE_API_SCOPE?.trim();
  if (scope) body.scope = scope;

  const response = await sireFetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: buildFormBody(body),
  });

  const payload = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  if (!response.ok) {
    throw new SireHttpError(extractApiError(payload, response.status), "HTTP", {
      status: response.status,
    });
  }

  const accessToken =
    typeof payload.access_token === "string" ? payload.access_token : null;
  if (!accessToken) {
    throw new SireHttpError(
      "SIRE API: respuesta de token sin access_token",
      "PARSE",
    );
  }

  return { accessToken, raw: payload };
}

async function probeApiWithToken(
  baseUrl: string,
  accessToken: string,
): Promise<void> {
  const testPath = getSireApiTestPath();
  if (!testPath) return;

  const response = await sireFetch(`${baseUrl}${testPath}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new SireHttpError(extractApiError(payload, response.status), "HTTP", {
      status: response.status,
    });
  }
}

export async function testSireApiConnection(
  credentials: SireApiCredentials,
): Promise<SireApiTestResult> {
  const baseUrl = getSireApiBaseUrl();
  if (!baseUrl) {
    return {
      ok: false,
      message:
        "SIRE API no configurada: define SIRE_API_BASE_URL o usa modo portal (sin SIRE_API_BASE_URL)",
    };
  }

  const clientId = credentials.clientId.trim();
  const clientSecret = credentials.clientSecret.trim();
  if (!clientId || !clientSecret) {
    return {
      ok: false,
      message: "Client ID y Client Secret son obligatorios para SIRE API",
    };
  }

  const { accessToken } = await requestOAuthToken(baseUrl, credentials);
  await probeApiWithToken(baseUrl, accessToken);

  return {
    ok: true,
    accessToken,
    message: "Conexión validada con la API SIRE (token OAuth)",
  };
}
