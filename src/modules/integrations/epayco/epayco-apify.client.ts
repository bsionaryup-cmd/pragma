import "server-only";

import {
  isEpaycoTestMode,
  resolveEpaycoApifyBaseUrl,
  type EpaycoEnvironment,
} from "@/modules/integrations/epayco/epayco.config";

type ApifyLoginResponse = {
  token?: string;
  bearer_token?: string;
  access_token?: string;
  message?: string;
};

export async function epaycoApifyLogin(input: {
  publicKey: string;
  privateKey: string;
  env: EpaycoEnvironment;
}): Promise<{ ok: boolean; token?: string; message: string }> {
  const baseUrl = resolveEpaycoApifyBaseUrl(input.env);

  try {
    const response = await fetch(`${baseUrl}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        public_key: input.publicKey,
        private_key: input.privateKey,
      }),
      cache: "no-store",
    });

    const payload = (await response.json()) as ApifyLoginResponse;

    if (!response.ok) {
      return {
        ok: false,
        message: payload.message ?? "ePayco rechazó las credenciales",
      };
    }

    const token =
      payload.token ?? payload.bearer_token ?? payload.access_token ?? undefined;

    if (!token?.trim()) {
      return { ok: false, message: "ePayco no devolvió token de autenticación" };
    }

    return { ok: true, token: token.trim(), message: "Autenticación exitosa" };
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
