import {
  AccessEventType,
  TTLockEnvironment,
  TTLockExpirationStrategy,
  TTLockIntegrationStatus,
  TTLockLockStatus,
  TTLockOnlineState,
  PropertyStatus,
} from "@prisma/client";
import { db } from "@/lib/db";
import {
  getTTLockOAuthAuthorizeUrl,
  isTTLockBrowserOAuthEnabled,
  resolveTTLockRedirectUri,
  type TTLockRequestContext,
} from "@/lib/integrations/ttlock-config";
import {
  createTTLockOAuthState,
  verifyTTLockOAuthState,
} from "@/services/integrations/ttlock/ttlock-oauth-state";
import { requestTTLockLockList } from "@/services/integrations/ttlock/ttlock-api.client";
import {
  decryptTTLockSecret,
  encryptTTLockSecret,
  ttlockPasswordMd5,
} from "@/services/integrations/ttlock/ttlock-crypto";
import {
  computeTokenExpiresAt,
  isTTLockLiveApiEnabled,
  requestTTLockAuthorizationCodeToken,
  requestTTLockPasswordToken,
  requestTTLockRefreshToken,
} from "@/services/integrations/ttlock/ttlock-oauth.client";
import {
  isTTLockSchemaDriftError,
  rethrowUnlessTTLockSchemaDrift,
  TTLOCK_SCHEMA_DRIFT_HINT,
} from "@/services/integrations/ttlock/ttlock-prisma-guard";
import { deriveOverviewMetrics } from "@/services/integrations/ttlock/ttlock-status";
import type {
  TTLockConnectionTestResult,
  TTLockOverviewDto,
  TTLockStatusPayload,
} from "@/services/integrations/ttlock/ttlock.types";

function assertTTLockPrismaDelegates(): void {
  const delegate = db.tTLockIntegration;
  if (!delegate || typeof delegate.upsert !== "function") {
    throw new Error(
      "Cliente Prisma desactualizado (modelos TTLock ausentes). Ejecuta npm run db:sync y reinicia npm run dev.",
    );
  }
}

function toIso(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString();
}

export type TTLockOverview = TTLockOverviewDto;

function hasAppCredentials(integration: {
  clientId: string | null;
  clientSecretEncrypted: string | null;
}): boolean {
  return Boolean(integration.clientId?.trim() && integration.clientSecretEncrypted);
}

function hasAccountCredentials(integration: {
  username: string | null;
  passwordHash: string | null;
}): boolean {
  return Boolean(integration.username?.trim() && integration.passwordHash);
}

function resolveIntegrationRedirect(integration: {
  redirectUri: string | null;
}) {
  return resolveTTLockRedirectUri({ storedRedirectUri: integration.redirectUri });
}

function getCanonicalRedirectUri(integration: { redirectUri: string | null }): string {
  const resolved = resolveIntegrationRedirect(integration);
  if (!resolved.validation.valid || !resolved.redirectUri) {
    throw new Error(resolved.validation.issues.join(" "));
  }
  return resolved.redirectUri;
}

async function getIntegrationSecrets(integration: {
  clientSecretEncrypted: string | null;
  refreshTokenEncrypted: string | null;
  accessTokenEncrypted: string | null;
}) {
  return {
    clientSecret: decryptTTLockSecret(integration.clientSecretEncrypted),
    refreshToken: decryptTTLockSecret(integration.refreshTokenEncrypted),
    accessToken: decryptTTLockSecret(integration.accessTokenEncrypted),
  };
}

export async function ensureTTLockIntegration(userId: string) {
  assertTTLockPrismaDelegates();

  try {
    const integration = await db.tTLockIntegration.upsert({
      where: { userId },
      create: {
        userId,
        status: TTLockIntegrationStatus.NOT_CONNECTED,
        environment: TTLockEnvironment.PRODUCTION,
        automationSettings: {
          create: {
            generateAfterGuestRegistration: true,
            requireManualApproval: false,
          },
        },
      },
      update: {},
      include: { automationSettings: true },
    });

    if (!integration.automationSettings) {
      await db.tTLockAutomationSettings.create({
        data: { integrationId: integration.id },
      });
      return db.tTLockIntegration.findUniqueOrThrow({
        where: { id: integration.id },
        include: { automationSettings: true },
      });
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    if (user?.organizationId && !integration.organizationId) {
      return db.tTLockIntegration.update({
        where: { id: integration.id },
        data: {
          organizationId: user.organizationId,
          configuredById: userId,
        },
        include: { automationSettings: true },
      });
    }

    return integration;
  } catch (error) {
    rethrowUnlessTTLockSchemaDrift(error);
  }
}

async function persistOAuthTokens(
  integrationId: string,
  token: {
    access_token: string;
    refresh_token?: string;
    uid?: number | string;
    expires_in?: number;
  },
  status: TTLockIntegrationStatus,
  clearError = true,
) {
  await db.tTLockIntegration.update({
    where: { id: integrationId },
    data: {
      accessTokenEncrypted: encryptTTLockSecret(token.access_token),
      refreshTokenEncrypted: token.refresh_token
        ? encryptTTLockSecret(token.refresh_token)
        : undefined,
      uid: token.uid != null ? String(token.uid) : null,
      expiresAt: computeTokenExpiresAt(token.expires_in),
      lastTokenRefreshAt: new Date(),
      status,
      ...(clearError ? { lastError: null } : {}),
    },
  });
}

async function exchangeTokensForIntegration(
  integration: {
    id: string;
    environment: TTLockEnvironment;
    clientId: string | null;
    clientSecretEncrypted: string | null;
    username: string | null;
    passwordHash: string | null;
    refreshTokenEncrypted: string | null;
    redirectUri: string | null;
  },
) {
  if (!hasAppCredentials(integration)) {
    throw new Error("Guarda Client ID y Client Secret antes de conectar TTLock");
  }

  const { clientSecret, refreshToken } = await getIntegrationSecrets({
    clientSecretEncrypted: integration.clientSecretEncrypted,
    refreshTokenEncrypted: integration.refreshTokenEncrypted,
    accessTokenEncrypted: null,
  });
  if (!clientSecret) {
    throw new Error("No se pudo descifrar el Client Secret TTLock");
  }

  const redirectUri = getCanonicalRedirectUri(integration);

  const token = refreshToken
    ? await requestTTLockRefreshToken({
        environment: integration.environment,
        clientId: integration.clientId!,
        clientSecret,
        refreshToken,
        redirectUri,
      })
    : await requestTTLockPasswordToken({
        environment: integration.environment,
        clientId: integration.clientId!,
        clientSecret,
        username: integration.username!,
        passwordMd5: integration.passwordHash!,
        redirectUri,
      });

  await persistOAuthTokens(
    integration.id,
    token,
    TTLockIntegrationStatus.CONNECTED,
  );
}

export async function getTTLockOverview(
  userId: string,
  options?: { request?: TTLockRequestContext; canManage?: boolean },
): Promise<TTLockOverviewDto> {
  try {
    return await loadTTLockOverview(userId, options);
  } catch (error) {
    if (isTTLockSchemaDriftError(error)) {
      throw new Error(TTLOCK_SCHEMA_DRIFT_HINT, {
        cause: error instanceof Error ? error : undefined,
      });
    }
    throw error;
  }
}

async function loadTTLockOverview(
  userId: string,
  options?: { request?: TTLockRequestContext; canManage?: boolean },
): Promise<TTLockOverviewDto> {
  assertTTLockPrismaDelegates();
  const integration = await ensureTTLockIntegration(userId);
  const resolved = resolveIntegrationRedirect(integration);
  const callbackUrl =
    resolved.validation.normalizedUrl ?? resolved.redirectUri;
  const callbackSource = resolved.source;
  const callbackValidation = resolved.validation;

  const [properties, propertyLocks, accessCredentialCount, eventCount] =
    await Promise.all([
      db.property.findMany({
        where: { ownerId: userId, status: PropertyStatus.ACTIVE },
        select: { id: true, name: true, address: true, city: true },
        orderBy: { name: "asc" },
      }),
      db.propertyLock.findMany({
        where: { integrationId: integration.id },
        include: {
          property: {
            select: { id: true, name: true, address: true, city: true },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
      db.accessCredential.count({
        where: {
          reservation: { property: { ownerId: userId } },
        },
      }),
      db.accessEvent.count({ where: { integrationId: integration.id } }),
    ]);

  const mappedCount = propertyLocks.filter((lock) => lock.ttlockLockId).length;
  const settings = integration.automationSettings;

  const metrics = deriveOverviewMetrics({
    status: integration.status,
    hasCredentials: hasAppCredentials(integration),
    hasAccessToken: Boolean(integration.accessTokenEncrypted),
    hasRefreshToken: Boolean(integration.refreshTokenEncrypted),
    expiresAt: integration.expiresAt,
    lastSyncedAt: integration.lastSyncedAt,
    mappedCount,
    propertyCount: properties.length,
    generateAfterGuestRegistration:
      settings?.generateAfterGuestRegistration ?? false,
    callbackValid: callbackValidation.valid,
  });

  return {
    integration: {
      id: integration.id,
      status: integration.status,
      environment: integration.environment,
      clientId: integration.clientId,
      username: integration.username,
      uid: integration.uid,
      hasClientSecret: Boolean(integration.clientSecretEncrypted),
      hasPassword: Boolean(integration.passwordHash),
      hasAccessToken: Boolean(integration.accessTokenEncrypted),
      hasRefreshToken: Boolean(integration.refreshTokenEncrypted),
      expiresAt: toIso(integration.expiresAt),
      lastSyncedAt: toIso(integration.lastSyncedAt),
      lastTokenRefreshAt: toIso(integration.lastTokenRefreshAt),
      lastError: integration.lastError,
      redirectUri: integration.redirectUri,
      automationSettings: settings
        ? {
            generateAfterGuestRegistration: settings.generateAfterGuestRegistration,
            revokeAfterCheckout: settings.revokeAfterCheckout,
            requireManualApproval: settings.requireManualApproval,
            autoSendCode: settings.autoSendCode,
            allowRegeneration: settings.allowRegeneration,
            expirationStrategy: settings.expirationStrategy,
          }
        : null,
    },
    callbackUrl,
    callbackSource,
    callbackValidation,
    canManage: options?.canManage ?? false,
    properties,
    propertyLocks,
    accessCredentialCount,
    eventCount,
    metrics,
    liveApiEnabled: isTTLockLiveApiEnabled(),
  };
}

export async function saveTTLockCredentials(
  userId: string,
  input: {
    clientId: string;
    clientSecret: string;
    environment: TTLockEnvironment;
  },
  _request?: TTLockRequestContext,
) {
  const integration = await ensureTTLockIntegration(userId);
  const clientId = input.clientId.trim() || integration.clientId;
  const clientSecretEncrypted = input.clientSecret.trim()
    ? encryptTTLockSecret(input.clientSecret)
    : integration.clientSecretEncrypted;
  const resolved = resolveTTLockRedirectUri({ storedRedirectUri: null });

  if (!resolved.validation.valid || !resolved.redirectUri) {
    throw new Error(resolved.validation.issues.join(" "));
  }

  const redirectUri = resolved.redirectUri;

  if (!clientId?.trim() || !clientSecretEncrypted) {
    throw new Error("Client ID y Client Secret son obligatorios");
  }

  const nextStatus = hasAppCredentials({
    clientId,
    clientSecretEncrypted,
  })
    ? integration.status === TTLockIntegrationStatus.NOT_CONNECTED
      ? TTLockIntegrationStatus.PENDING_SETUP
      : integration.status
    : TTLockIntegrationStatus.NOT_CONNECTED;

  await db.tTLockIntegration.update({
    where: { id: integration.id },
    data: {
      clientId,
      clientSecretEncrypted,
      environment: input.environment,
      redirectUri,
      status: nextStatus,
      lastError: null,
    },
  });
}

/** @deprecated Use saveTTLockCredentials + completeTTLockConnect */
export async function saveTTLockConnection(
  userId: string,
  input: {
    clientId: string;
    clientSecret: string;
    username: string;
    password: string;
  },
  request?: TTLockRequestContext,
) {
  await saveTTLockCredentials(
    userId,
    {
      clientId: input.clientId,
      clientSecret: input.clientSecret,
      environment: TTLockEnvironment.PRODUCTION,
    },
    request,
  );

  if (input.username.trim() || input.password.trim()) {
    await completeTTLockConnect(
      userId,
      {
        username: input.username,
        password: input.password,
      },
      request,
    );
  }
}

export function buildTTLockConnectSession(userId: string) {
  const state = createTTLockOAuthState(userId);
  return { state };
}

export async function beginTTLockConnect(
  userId: string,
  _request?: TTLockRequestContext,
): Promise<{
  redirectUrl: string;
  state: string;
  redirectUri: string;
  mode: "browser_oauth" | "account_credentials";
}> {
  const integration = await ensureTTLockIntegration(userId);

  if (!hasAppCredentials(integration)) {
    throw new Error("Guarda Client ID y Client Secret antes de conectar");
  }

  const resolved = resolveIntegrationRedirect(integration);
  if (!resolved.validation.valid || !resolved.redirectUri) {
    throw new Error(resolved.validation.issues.join(" "));
  }

  const redirectUri = resolved.redirectUri;
  const { state } = buildTTLockConnectSession(userId);

  await db.tTLockIntegration.update({
    where: { id: integration.id },
    data: {
      status: TTLockIntegrationStatus.CONNECTING,
      redirectUri,
      lastError: null,
    },
  });

  const connectPath = `/integrations/ttlock/connect?state=${encodeURIComponent(state)}`;

  if (!isTTLockBrowserOAuthEnabled()) {
    return {
      redirectUrl: connectPath,
      state,
      redirectUri,
      mode: "account_credentials",
    };
  }

  const authorizeUrl = getTTLockOAuthAuthorizeUrl(integration.environment, {
    clientId: integration.clientId!,
    redirectUri,
    state,
  });

  return {
    redirectUrl: authorizeUrl,
    state,
    redirectUri,
    mode: "browser_oauth",
  };
}

export async function completeTTLockConnect(
  userId: string,
  input: { username: string; password: string },
  request?: TTLockRequestContext,
) {
  const integration = await ensureTTLockIntegration(userId);

  if (!hasAppCredentials(integration)) {
    throw new Error("Guarda Client ID y Client Secret antes de conectar");
  }

  const username = input.username.trim();
  const passwordHash = ttlockPasswordMd5(input.password);
  if (!username || !passwordHash) {
    throw new Error("Usuario y contraseña TTLock son obligatorios");
  }

  const resolved = resolveIntegrationRedirect(integration);
  if (!resolved.validation.valid || !resolved.redirectUri) {
    throw new Error(resolved.validation.issues.join(" "));
  }
  const redirectUri = resolved.redirectUri;

  await db.tTLockIntegration.update({
    where: { id: integration.id },
    data: {
      username,
      passwordHash,
      redirectUri,
      status: TTLockIntegrationStatus.CONNECTING,
      lastError: null,
    },
  });

  const refreshed = await db.tTLockIntegration.findUniqueOrThrow({
    where: { id: integration.id },
  });

  if (isTTLockLiveApiEnabled()) {
    try {
      await exchangeTokensForIntegration(refreshed);
      await db.accessEvent.create({
        data: {
          integrationId: integration.id,
          eventType: AccessEventType.TOKEN_REFRESHED,
          payload: { mode: "password_oauth", redirectUri },
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error al conectar con TTLock";
      await db.tTLockIntegration.update({
        where: { id: integration.id },
        data: {
          status: TTLockIntegrationStatus.INVALID_CREDENTIALS,
          lastError: message,
        },
      });
      throw error;
    }
  } else {
    await db.tTLockIntegration.update({
      where: { id: integration.id },
      data: { status: TTLockIntegrationStatus.CONNECTED, lastError: null },
    });
  }
}

export async function handleTTLockOAuthCallback(input: {
  code?: string | null;
  state?: string | null;
  error?: string | null;
  errorDescription?: string | null;
  request?: TTLockRequestContext;
}): Promise<{ redirectPath: string }> {
  const basePath = "/integrations/ttlock";

  if (input.error) {
    const message =
      input.errorDescription?.trim() ||
      input.error ||
      "Autorización TTLock denegada";
    return {
      redirectPath: `${basePath}?error=${encodeURIComponent(message)}`,
    };
  }

  const state = input.state?.trim();
  if (!state) {
    return {
      redirectPath: `${basePath}?error=${encodeURIComponent("Estado OAuth inválido")}`,
    };
  }

  const verified = verifyTTLockOAuthState(state);
  if (!verified) {
    return {
      redirectPath: `${basePath}?error=${encodeURIComponent("Sesión OAuth expirada o inválida")}`,
    };
  }

  const integration = await ensureTTLockIntegration(verified.userId);

  if (!input.code?.trim()) {
    return {
      redirectPath: `${basePath}/connect?state=${encodeURIComponent(state)}`,
    };
  }

  if (!hasAppCredentials(integration)) {
    return {
      redirectPath: `${basePath}?error=${encodeURIComponent("Configura credenciales TTLock primero")}`,
    };
  }

  const clientSecret = decryptTTLockSecret(integration.clientSecretEncrypted);
  if (!clientSecret) {
    return {
      redirectPath: `${basePath}?error=${encodeURIComponent("Client Secret no disponible")}`,
    };
  }

  if (!isTTLockLiveApiEnabled()) {
    await db.tTLockIntegration.update({
      where: { id: integration.id },
      data: { status: TTLockIntegrationStatus.CONNECTED, lastError: null },
    });
    return { redirectPath: `${basePath}?connected=1` };
  }

  try {
    const redirectUri = getCanonicalRedirectUri(integration);
    const token = await requestTTLockAuthorizationCodeToken({
      environment: integration.environment,
      clientId: integration.clientId!,
      clientSecret,
      code: input.code.trim(),
      redirectUri,
    });

    await persistOAuthTokens(
      integration.id,
      token,
      TTLockIntegrationStatus.CONNECTED,
    );

    await db.tTLockIntegration.update({
      where: { id: integration.id },
      data: { redirectUri },
    });

    await db.accessEvent.create({
      data: {
        integrationId: integration.id,
        eventType: AccessEventType.TOKEN_REFRESHED,
        payload: { mode: "authorization_code", redirectUri },
      },
    });

    return { redirectPath: `${basePath}?connected=1` };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al intercambiar código OAuth";
    await db.tTLockIntegration.update({
      where: { id: integration.id },
      data: {
        status: TTLockIntegrationStatus.INVALID_CREDENTIALS,
        lastError: message,
      },
    });
    return {
      redirectPath: `${basePath}?error=${encodeURIComponent(message)}`,
    };
  }
}

export async function testTTLockConnection(
  userId: string,
  _request?: TTLockRequestContext,
): Promise<TTLockConnectionTestResult> {
  const integration = await ensureTTLockIntegration(userId);
  const checkedAt = new Date().toISOString();
  const steps: string[] = [];

  if (!hasAppCredentials(integration)) {
    return {
      ok: false,
      message: "Configura Client ID y Client Secret",
      checkedAt,
      steps,
    };
  }

  const resolved = resolveIntegrationRedirect(integration);
  steps.push(
    resolved.validation.valid
      ? `Callback OK: ${resolved.redirectUri}`
      : `Callback inválido: ${resolved.validation.issues.join("; ")}`,
  );

  if (!resolved.validation.valid) {
    await db.tTLockIntegration.update({
      where: { id: integration.id },
      data: {
        lastError: resolved.validation.issues.join(" "),
      },
    });
    return {
      ok: false,
      message: resolved.validation.issues.join(" "),
      checkedAt,
      callbackValid: false,
      steps,
    };
  }

  try {
    const probe = await fetch(resolved.redirectUri, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    const payload = (await probe.json().catch(() => ({}))) as { ok?: boolean };
    if (probe.ok && payload.ok) {
      steps.push(`Callback route OK (HTTP ${probe.status})`);
    } else {
      steps.push(
        `Callback respondió HTTP ${probe.status} — despliega la última versión en Vercel si ves 404`,
      );
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "probe failed";
    steps.push(`Callback no alcanzable: ${msg}`);
  }

  if (!isTTLockLiveApiEnabled()) {
    const ok = hasAppCredentials(integration) && resolved.validation.valid;
    return {
      ok,
      message: ok
        ? `Callback pública válida. API live desactivada (${resolved.redirectUri})`
        : "Sin credenciales",
      checkedAt,
      callbackValid: resolved.validation.valid,
      steps,
    };
  }

  const secrets = await getIntegrationSecrets(integration);
  if (!secrets.clientSecret) {
    return {
      ok: false,
      message: "No se pudo descifrar el Client Secret",
      checkedAt,
      callbackValid: resolved.validation.valid,
      steps,
    };
  }

  let accessToken = secrets.accessToken;

  if (!accessToken) {
    if (!hasAccountCredentials(integration) && !integration.refreshTokenEncrypted) {
      return {
        ok: false,
        message: "Conecta la cuenta TTLock antes de probar",
        checkedAt,
        callbackValid: true,
        steps,
      };
    }

    try {
      await exchangeTokensForIntegration(integration);
      const refreshed = await db.tTLockIntegration.findUniqueOrThrow({
        where: { id: integration.id },
      });
      accessToken = decryptTTLockSecret(refreshed.accessTokenEncrypted);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo obtener token";
      await db.tTLockIntegration.update({
        where: { id: integration.id },
        data: {
          status: TTLockIntegrationStatus.INVALID_CREDENTIALS,
          lastError: message,
        },
      });
      return { ok: false, message, checkedAt, callbackValid: true, steps };
    }
  }

  if (!accessToken) {
    return {
      ok: false,
      message: "Sin access token. Conecta TTLock primero.",
      checkedAt,
      callbackValid: true,
      steps,
    };
  }

  const apiResult = await requestTTLockLockList({
    environment: integration.environment,
    clientId: integration.clientId!,
    accessToken,
  });

  if (!apiResult.ok) {
    await db.tTLockIntegration.update({
      where: { id: integration.id },
      data: {
        status: TTLockIntegrationStatus.SYNC_ERROR,
        lastError: apiResult.message,
      },
    });
    return {
      ok: false,
      message: apiResult.message,
      checkedAt,
      callbackValid: true,
      steps,
    };
  }

  await db.tTLockIntegration.update({
    where: { id: integration.id },
    data: {
      status: TTLockIntegrationStatus.CONNECTED,
      lastError: null,
    },
  });

  steps.push(`API TTLock OK (${apiResult.total}+ locks)`);

  return {
    ok: true,
    message: `Conexión válida. Callback: ${resolved.redirectUri}. Locks: ${apiResult.total}+`,
    checkedAt,
    callbackValid: true,
    steps,
  };
}

export async function getTTLockStatusPayload(
  userId: string,
): Promise<TTLockStatusPayload> {
  const overview = await getTTLockOverview(userId);
  return {
    status: overview.integration.status,
    statusLabel: overview.metrics.integrationStatusLabel,
    hasCredentials: overview.metrics.hasCredentials,
    hasTokens: overview.metrics.hasTokens,
    tokenHealth: overview.metrics.tokenHealthLabel,
    lastError: overview.integration.lastError,
    uid: overview.integration.uid,
    expiresAt: overview.integration.expiresAt,
  };
}

export async function disconnectTTLock(userId: string) {
  const integration = await ensureTTLockIntegration(userId);
  await db.tTLockIntegration.update({
    where: { id: integration.id },
    data: {
      clientId: null,
      clientSecretEncrypted: null,
      username: null,
      passwordHash: null,
      accessTokenEncrypted: null,
      refreshTokenEncrypted: null,
      uid: null,
      expiresAt: null,
      redirectUri: null,
      lastError: null,
      status: TTLockIntegrationStatus.NOT_CONNECTED,
      lastTokenRefreshAt: null,
    },
  });
}

export async function refreshTTLockToken(
  userId: string,
  request?: TTLockRequestContext,
) {
  const integration = await ensureTTLockIntegration(userId);

  if (!hasAppCredentials(integration)) {
    throw new Error("Configura credenciales TTLock antes de refrescar el token");
  }

  if (!hasAccountCredentials(integration) && !integration.refreshTokenEncrypted) {
    throw new Error("Conecta TTLock antes de refrescar el token");
  }

  if (isTTLockLiveApiEnabled()) {
    try {
      await exchangeTokensForIntegration(integration);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error al refrescar token";
      await db.tTLockIntegration.update({
        where: { id: integration.id },
        data: {
          status: TTLockIntegrationStatus.TOKEN_EXPIRED,
          lastError: message,
        },
      });
      throw error;
    }
  } else {
    await db.tTLockIntegration.update({
      where: { id: integration.id },
      data: {
        lastTokenRefreshAt: new Date(),
        status: TTLockIntegrationStatus.CONNECTED,
      },
    });
  }

  await db.accessEvent.create({
    data: {
      integrationId: integration.id,
      eventType: AccessEventType.TOKEN_REFRESHED,
      payload: {
        mode: isTTLockLiveApiEnabled() ? "live_oauth" : "prepared_without_live_api",
      },
    },
  });
}

export async function syncTTLockLocksPlaceholder(userId: string) {
  const integration = await ensureTTLockIntegration(userId);

  await db.tTLockIntegration.update({
    where: { id: integration.id },
    data: {
      lastSyncedAt: new Date(),
      status:
        integration.status === TTLockIntegrationStatus.SYNC_ERROR
          ? integration.status
          : integration.status === TTLockIntegrationStatus.NOT_CONNECTED
            ? TTLockIntegrationStatus.PENDING_SETUP
            : TTLockIntegrationStatus.READY,
    },
  });

  await db.accessEvent.create({
    data: {
      integrationId: integration.id,
      eventType: AccessEventType.LOCK_SYNCED,
      payload: { mode: "placeholder_ready_for_api" },
    },
  });
}

export async function savePropertyLockMapping(
  userId: string,
  input: {
    propertyId: string;
    ttlockLockId: string;
    alias: string;
    timezone: string;
  },
) {
  const integration = await ensureTTLockIntegration(userId);
  const property = await db.property.findFirst({
    where: { id: input.propertyId, ownerId: userId },
    select: { id: true },
  });
  if (!property) throw new Error("Propiedad no encontrada");

  await db.propertyLock.upsert({
    where: { propertyId: property.id },
    create: {
      integrationId: integration.id,
      propertyId: property.id,
      ttlockLockId: input.ttlockLockId.trim() || null,
      alias: input.alias.trim() || null,
      timezone: input.timezone.trim() || null,
      lockStatus: input.ttlockLockId.trim()
        ? TTLockLockStatus.MAPPED
        : TTLockLockStatus.UNMAPPED,
      onlineState: TTLockOnlineState.UNKNOWN,
    },
    update: {
      ttlockLockId: input.ttlockLockId.trim() || null,
      alias: input.alias.trim() || null,
      timezone: input.timezone.trim() || null,
      lockStatus: input.ttlockLockId.trim()
        ? TTLockLockStatus.MAPPED
        : TTLockLockStatus.UNMAPPED,
    },
  });
}

export async function saveTTLockAutomationSettings(
  userId: string,
  input: {
    generateAfterGuestRegistration: boolean;
    revokeAfterCheckout: boolean;
    requireManualApproval: boolean;
    autoSendCode: boolean;
    allowRegeneration: boolean;
    expirationStrategy: TTLockExpirationStrategy;
  },
) {
  const integration = await ensureTTLockIntegration(userId);
  await db.tTLockAutomationSettings.upsert({
    where: { integrationId: integration.id },
    create: { integrationId: integration.id, ...input },
    update: input,
  });
}
