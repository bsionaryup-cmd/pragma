import { getSireRequestTimeoutMs } from "@/lib/integrations/sire-config";

export type SireHttpErrorCode = "TIMEOUT" | "NETWORK" | "HTTP" | "PARSE";

export class SireHttpError extends Error {
  readonly code: SireHttpErrorCode;
  readonly status?: number;

  constructor(
    message: string,
    code: SireHttpErrorCode,
    options?: { status?: number; cause?: unknown },
  ) {
    super(message);
    this.name = "SireHttpError";
    this.code = code;
    this.status = options?.status;
    if (options?.cause) this.cause = options.cause;
  }
}

export function mergeSetCookieHeaders(
  existing: string | undefined,
  setCookie: string | string[] | undefined,
): string {
  const jar = new Map<string, string>();
  const ingest = (line: string) => {
    const pair = line.split(";")[0]?.trim();
    if (!pair) return;
    const eq = pair.indexOf("=");
    if (eq <= 0) return;
    jar.set(pair.slice(0, eq), pair.slice(eq + 1));
  };

  if (existing) {
    for (const part of existing.split(";")) ingest(part);
  }

  if (setCookie) {
    const list = Array.isArray(setCookie) ? setCookie : [setCookie];
    for (const entry of list) ingest(entry);
  }

  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

export async function sireFetch(
  url: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<Response> {
  const timeoutMs = init?.timeoutMs ?? getSireRequestTimeoutMs();
  const { timeoutMs: _omit, ...rest } = init ?? {};

  try {
    return await fetch(url, {
      ...rest,
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new SireHttpError(
        `SIRE: tiempo de espera agotado (${timeoutMs} ms)`,
        "TIMEOUT",
        { cause: error },
      );
    }
    const message =
      error instanceof Error ? error.message : "Error de red al contactar SIRE";
    throw new SireHttpError(`SIRE: ${message}`, "NETWORK", { cause: error });
  }
}
