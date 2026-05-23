import type { TTLockEnvironment } from "@prisma/client";
import { getTTLockOAuthTokenUrl } from "@/lib/integrations/ttlock-config";
import { isPlatformTTLockConfigured } from "@/lib/integrations/ttlock-platform";
import { ttlockPasswordMd5 } from "@/services/integrations/ttlock/ttlock-crypto";

export { ttlockPasswordMd5 };

export type TTLockOAuthTokenResponse = {
  access_token: string;
  refresh_token?: string;
  uid?: number | string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
};

export type TTLockOAuthCredentials = {
  environment: TTLockEnvironment;
  clientId: string;
  clientSecret: string;
  username: string;
  passwordMd5: string;
  redirectUri: string;
};

export type TTLockOAuthRefreshInput = {
  environment: TTLockEnvironment;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  redirectUri: string;
};

export type TTLockOAuthCodeInput = {
  environment: TTLockEnvironment;
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
};

export function isTTLockLiveApiEnabled(): boolean {
  if (process.env.TTLOCK_API_ENABLED === "false") return false;
  if (process.env.TTLOCK_API_ENABLED === "true") return true;
  return isPlatformTTLockConfigured();
}

function buildFormBody(entries: Record<string, string>): string {
  return new URLSearchParams(entries).toString();
}

async function postToken(
  environment: TTLockEnvironment,
  body: Record<string, string>,
): Promise<TTLockOAuthTokenResponse> {
  const response = await fetch(getTTLockOAuthTokenUrl(environment), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: buildFormBody(body),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  const errcode = payload.errcode;
  if (typeof errcode === "number" && errcode !== 0) {
    const errmsg =
      typeof payload.errmsg === "string" ? payload.errmsg : `error ${errcode}`;
    if (errcode === 10008) {
      throw new Error(
        `redirect_uri inválido (10008): debe coincidir exactamente con la URL registrada en el portal TTLock Open Platform. ${errmsg}`,
      );
    }
    throw new Error(`TTLock OAuth (${errcode}): ${errmsg}`);
  }

  if (!response.ok) {
    const message =
      typeof payload.errmsg === "string"
        ? payload.errmsg
        : typeof payload.error_description === "string"
          ? payload.error_description
          : `TTLock OAuth error (${response.status})`;
    throw new Error(message);
  }

  if (typeof payload.access_token !== "string" || !payload.access_token) {
    throw new Error("TTLock OAuth no devolvió access_token");
  }

  return payload as TTLockOAuthTokenResponse;
}

export async function requestTTLockPasswordToken(
  input: TTLockOAuthCredentials,
): Promise<TTLockOAuthTokenResponse> {
  const passwordMd5 = input.passwordMd5.trim().toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(passwordMd5)) {
    throw new Error("La contraseña TTLock (MD5) es obligatoria para conectar");
  }

  return postToken(input.environment, {
    client_id: input.clientId.trim(),
    client_secret: input.clientSecret.trim(),
    username: input.username.trim(),
    password: passwordMd5,
    redirect_uri: input.redirectUri.trim(),
    grant_type: "password",
  });
}

export async function requestTTLockPasswordTokenFromPlainPassword(input: {
  environment: TTLockEnvironment;
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  redirectUri: string;
}): Promise<TTLockOAuthTokenResponse> {
  const passwordMd5 = ttlockPasswordMd5(input.password);
  if (!passwordMd5) {
    throw new Error("La contraseña TTLock es obligatoria para conectar");
  }
  return requestTTLockPasswordToken({ ...input, passwordMd5 });
}

export async function requestTTLockRefreshToken(
  input: TTLockOAuthRefreshInput,
): Promise<TTLockOAuthTokenResponse> {
  return postToken(input.environment, {
    client_id: input.clientId.trim(),
    client_secret: input.clientSecret.trim(),
    refresh_token: input.refreshToken.trim(),
    redirect_uri: input.redirectUri.trim(),
    grant_type: "refresh_token",
  });
}

export async function requestTTLockAuthorizationCodeToken(
  input: TTLockOAuthCodeInput,
): Promise<TTLockOAuthTokenResponse> {
  return postToken(input.environment, {
    client_id: input.clientId.trim(),
    client_secret: input.clientSecret.trim(),
    code: input.code.trim(),
    redirect_uri: input.redirectUri.trim(),
    grant_type: "authorization_code",
  });
}

export function computeTokenExpiresAt(expiresIn?: number): Date | null {
  if (!expiresIn || expiresIn <= 0) return null;
  return new Date(Date.now() + expiresIn * 1000);
}
