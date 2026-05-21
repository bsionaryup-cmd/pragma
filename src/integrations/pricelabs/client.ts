import {
  getPriceLabsBaseUrl,
  getPriceLabsRequestTimeoutMs,
  PRICELABS_RATE_LIMIT_PER_MINUTE,
} from "@/lib/integrations/pricelabs-config";
import {
  buildPriceLabsHeaders,
  type PriceLabsAuthConfig,
  resolvePriceLabsAuth,
} from "@/integrations/pricelabs/auth";
import type { PriceLabsResult } from "@/integrations/pricelabs/types";

const LOG_PREFIX = "[pricelabs]";

type HttpMethod = "GET" | "POST" | "PUT";

type RequestOptions = {
  method?: HttpMethod;
  body?: unknown;
  auth?: PriceLabsAuthConfig;
  userTokenOverride?: string | null;
  /** Safe to retry on network/5xx */
  retryable?: boolean;
  signal?: AbortSignal;
};

let lastRequestAt = 0;
const minIntervalMs = Math.ceil(60_000 / PRICELABS_RATE_LIMIT_PER_MINUTE);

async function throttle(): Promise<void> {
  const now = Date.now();
  const wait = lastRequestAt + minIntervalMs - now;
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
  lastRequestAt = Date.now();
}

function normalizeErrorMessage(payload: unknown, status: number): string {
  if (!payload || typeof payload !== "object") {
    return `PriceLabs API error (${status})`;
  }
  const record = payload as Record<string, unknown>;
  const message =
    (typeof record.message === "string" && record.message) ||
    (typeof record.error === "string" && record.error) ||
    (typeof record.errmsg === "string" && record.errmsg) ||
    (typeof record.detail === "string" && record.detail);
  const code =
    typeof record.code === "string"
      ? record.code
      : typeof record.errcode === "number"
        ? String(record.errcode)
        : undefined;
  if (message && code) return `${message} (${code})`;
  return message ?? `PriceLabs API error (${status})`;
}

function extractCode(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const record = payload as Record<string, unknown>;
  if (typeof record.code === "string") return record.code;
  if (typeof record.errcode === "number") return String(record.errcode);
  return undefined;
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

export async function priceLabsRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<PriceLabsResult<T>> {
  const auth =
    options.auth ??
    resolvePriceLabsAuth({ userTokenOverride: options.userTokenOverride });

  const method = options.method ?? "GET";
  const url = `${getPriceLabsBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  const timeoutMs = getPriceLabsRequestTimeoutMs();
  const maxAttempts = options.retryable ? 3 : 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await throttle();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const signal = options.signal ?? controller.signal;

    const started = Date.now();
    console.info(LOG_PREFIX, method, url, { attempt, maxAttempts });

    try {
      const response = await fetch(url, {
        method,
        headers: buildPriceLabsHeaders(auth),
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

      const elapsed = Date.now() - started;
      console.info(LOG_PREFIX, method, path, {
        status: response.status,
        elapsedMs: elapsed,
      });

      if (!response.ok) {
        const message = normalizeErrorMessage(payload, response.status);
        if (
          options.retryable &&
          isRetryableStatus(response.status) &&
          attempt < maxAttempts
        ) {
          await sleep(400 * attempt);
          continue;
        }
        return {
          ok: false,
          message,
          status: response.status,
          code: extractCode(payload),
        };
      }

      return { ok: true, data: payload as T };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error de red PriceLabs";
      if (options.retryable && attempt < maxAttempts) {
        await sleep(400 * attempt);
        continue;
      }
      return { ok: false, message };
    } finally {
      clearTimeout(timeout);
    }
  }

  return { ok: false, message: "PriceLabs request failed after retries" };
}
