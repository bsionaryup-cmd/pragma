import { getTraaRequestTimeoutMs } from "@/lib/integrations/traa-config";

export type TraaHttpErrorCode = "TIMEOUT" | "NETWORK" | "HTTP" | "PARSE";

export class TraaHttpError extends Error {
  readonly code: TraaHttpErrorCode;
  readonly status?: number;

  constructor(
    message: string,
    code: TraaHttpErrorCode,
    options?: { status?: number; cause?: unknown },
  ) {
    super(message);
    this.name = "TraaHttpError";
    this.code = code;
    this.status = options?.status;
    if (options?.cause) this.cause = options.cause;
  }
}

export async function traaFetch(
  url: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<Response> {
  const timeoutMs = init?.timeoutMs ?? getTraaRequestTimeoutMs();
  const { timeoutMs: _omit, ...rest } = init ?? {};

  try {
    return await fetch(url, {
      ...rest,
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new TraaHttpError(
        `TRAA: tiempo de espera agotado (${timeoutMs} ms)`,
        "TIMEOUT",
        { cause: error },
      );
    }
    const message =
      error instanceof Error ? error.message : "Error de red al contactar TRAA";
    throw new TraaHttpError(`TRAA: ${message}`, "NETWORK", { cause: error });
  }
}
