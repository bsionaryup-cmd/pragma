import {
  isEpaycoTestMode,
  resolveEpaycoApifyBaseUrl,
  type EpaycoEnvironment,
} from "@/modules/integrations/epayco/epayco.config";

type ApifyLoginResponse = {
  success?: boolean;
  title_response?: string;
  text_response?: string;
  message?: string;
  token?: string;
  bearer_token?: string;
  access_token?: string;
  jwt?: string;
  data?: {
    token?: string;
    bearer_token?: string;
    access_token?: string;
    jwt?: string;
  };
};

export function extractEpaycoAuthToken(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;

  const record = payload as Record<string, unknown>;
  const candidates = [
    record.token,
    record.bearer_token,
    record.access_token,
    record.jwt,
  ];

  const data = record.data;
  if (data && typeof data === "object") {
    const nested = data as Record<string, unknown>;
    candidates.push(nested.token, nested.bearer_token, nested.access_token, nested.jwt);
  }

  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function resolveLoginFailureMessage(payload: ApifyLoginResponse): string {
  return (
    payload.text_response?.trim() ||
    payload.title_response?.trim() ||
    payload.message?.trim() ||
    "ePayco rechazó las credenciales"
  );
}

export async function epaycoApifyLogin(input: {
  publicKey: string;
  privateKey: string;
  env: EpaycoEnvironment;
}): Promise<{ ok: boolean; token?: string; message: string }> {
  const baseUrl = resolveEpaycoApifyBaseUrl(input.env);
  const basic = Buffer.from(`${input.publicKey}:${input.privateKey}`).toString("base64");

  try {
    const response = await fetch(`${baseUrl}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${basic};`,
      },
      body: JSON.stringify({}),
      cache: "no-store",
    });

    const payload = (await response.json()) as ApifyLoginResponse;

    if (!response.ok) {
      return {
        ok: false,
        message: resolveLoginFailureMessage(payload),
      };
    }

    if (payload.success === false) {
      return {
        ok: false,
        message: resolveLoginFailureMessage(payload),
      };
    }

    const token = extractEpaycoAuthToken(payload);

    if (!token) {
      return { ok: false, message: "ePayco no devolvió token de autenticación" };
    }

    return { ok: true, token, message: "Autenticación exitosa" };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Error al contactar ePayco Apify",
    };
  }
}

export async function epaycoApifyHealthCheck(input: {
  publicKey: string;
  privateKey: string;
  env: EpaycoEnvironment;
}): Promise<{ ok: boolean; message: string }> {
  const login = await epaycoApifyLogin(input);
  if (!login.ok) return login;

  return {
    ok: true,
    message: isEpaycoTestMode(input.env)
      ? "Conexión ePayco OK (modo prueba)"
      : "Conexión ePayco OK (producción)",
  };
}
