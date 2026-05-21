import {
  getPriceLabsApiBaseUrl,
  getPriceLabsRequestTimeoutMs,
  PRICELABS_RATE_LIMIT_PER_HOUR,
  PRICELABS_RATE_LIMIT_PER_MINUTE,
} from "@/lib/integrations/pricelabs-config";
import { buildPriceLabsHeaders } from "@/integrations/pricelabs/auth";
import { resolvePriceLabsApiKey } from "@/services/integrations/pricelabs/pricelabs-credentials";
import { isBenignListingError } from "@/integrations/pricelabs/normalize";
import type { PriceLabsResult } from "@/integrations/pricelabs/types";

const LOG_PREFIX = "[pricelabs]";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

type RequestOptions = {
  method?: HttpMethod;
  body?: unknown;
  /** Safe to retry on network/5xx/429 */
  retryable?: boolean;
  signal?: AbortSignal;
};

let lastMinuteRequestAt = 0;
let hourWindowStart = 0;
let hourRequestCount = 0;
let circuitOpenUntil = 0;
let consecutiveFailures = 0;

const minIntervalMs = Math.ceil(60_000 / PRICELABS_RATE_LIMIT_PER_MINUTE);

async function throttle(): Promise<void> {
  const now = Date.now();
  if (now < circuitOpenUntil) {
    throw new Error("PriceLabs circuit breaker abierto — reintenta más tarde");
  }

  if (now - hourWindowStart > 3_600_000) {
    hourWindowStart = now;
    hourRequestCount = 0;
  }
  if (hourRequestCount >= PRICELABS_RATE_LIMIT_PER_HOUR) {
    const wait = hourWindowStart + 3_600_000 - now;
    if (wait > 0) await new Promise((r) => setTimeout(r, Math.min(wait, 60_000)));
  }

  const waitMin = lastMinuteRequestAt + minIntervalMs - now;
  if (waitMin > 0) await new Promise((r) => setTimeout(r, waitMin));

  lastMinuteRequestAt = Date.now();
  hourRequestCount += 1;
}

function normalizeErrorMessage(payload: unknown, status: number): string {
  if (!payload || typeof payload !== "object") {
    return `PriceLabs API error (${status})`;
  }
  const record = payload as Record<string, unknown>;
  const message =
    (typeof record.message === "string" ? record.message : null) ||
    (typeof record.error === "string" ? record.error : null) ||
    (typeof record.detail === "string" ? record.detail : null);
  const code =
    typeof record.code === "string"
      ? record.code
      : typeof record.error_code === "string"
        ? record.error_code
        : undefined;
  if (message && code) return `${message} (${code})`;
  return message ?? `PriceLabs API error (${status})`;
}

function extractCode(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const record = payload as Record<string, unknown>;
  if (typeof record.code === "string") return record.code;
  if (typeof record.error_code === "string") return record.error_code;
  return undefined;
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function recordSuccess(): void {
  consecutiveFailures = 0;
}

function recordFailure(): void {
  consecutiveFailures += 1;
  if (consecutiveFailures >= 5) {
    circuitOpenUntil = Date.now() + 60_000;
  }
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

export async function priceLabsRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<PriceLabsResult<T>> {
  const method = options.method ?? "GET";
  const base = getPriceLabsApiBaseUrl();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const timeoutMs = getPriceLabsRequestTimeoutMs();
  const maxAttempts = options.retryable ? 4 : 1;

  const apiKey = await resolvePriceLabsApiKey();
  if (!apiKey) {
    return {
      ok: false,
      message: "Configura la API key de PriceLabs (panel o PRICELABS_API_KEY)",
      code: "MISSING_API_KEY",
    };
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await throttle();
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Rate limit",
        code: "CIRCUIT_OPEN",
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const signal = options.signal ?? controller.signal;

    const started = Date.now();
    console.info(LOG_PREFIX, method, path, { attempt, maxAttempts });

    try {
      const response = await fetch(url, {
        method,
        headers: buildPriceLabsHeaders(apiKey),
        body:
          options.body !== undefined
            ? JSON.stringify(options.body)
            : undefined,
        cache: "no-store",
        signal,
      });

      const raw = await response.text();
      let payload: unknown = {};
      if (raw) {
        try {
          payload = JSON.parse(raw) as unknown;
        } catch {
          payload = { message: raw.slice(0, 500) };
        }
      }

      console.info(LOG_PREFIX, method, path, {
        status: response.status,
        elapsedMs: Date.now() - started,
      });

      if (!response.ok) {
        const message = normalizeErrorMessage(payload, response.status);
        const code = extractCode(payload);
        if (isBenignListingError(code, message)) {
          recordSuccess();
          return { ok: true, data: payload as T };
        }
        recordFailure();
        if (
          options.retryable &&
          isRetryableStatus(response.status) &&
          attempt < maxAttempts
        ) {
          await sleep(500 * 2 ** (attempt - 1));
          continue;
        }
        return { ok: false, message, status: response.status, code };
      }

      recordSuccess();
      return { ok: true, data: payload as T };
    } catch (error) {
      recordFailure();
      const message =
        error instanceof Error ? error.message : "Error de red PriceLabs";
      if (options.retryable && attempt < maxAttempts) {
        await sleep(500 * 2 ** (attempt - 1));
        continue;
      }
      return { ok: false, message };
    } finally {
      clearTimeout(timeout);
    }
  }

  return { ok: false, message: "PriceLabs request failed after retries" };
}
