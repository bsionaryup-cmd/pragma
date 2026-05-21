import type { TTLockEnvironment } from "@prisma/client";
import { getTTLockLockListUrl } from "@/lib/integrations/ttlock-config";

export type TTLockApiError = {
  errcode?: number;
  errmsg?: string;
};

export async function requestTTLockLockList(input: {
  environment: TTLockEnvironment;
  clientId: string;
  accessToken: string;
  pageNo?: number;
  pageSize?: number;
}): Promise<{ ok: true; total: number } | { ok: false; message: string }> {
  const date = Date.now();
  const url = new URL(getTTLockLockListUrl(input.environment));
  url.searchParams.set("clientId", input.clientId);
  url.searchParams.set("accessToken", input.accessToken);
  url.searchParams.set("pageNo", String(input.pageNo ?? 1));
  url.searchParams.set("pageSize", String(input.pageSize ?? 1));
  url.searchParams.set("date", String(date));

  const response = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  > & TTLockApiError;

  if (typeof payload.errcode === "number" && payload.errcode !== 0) {
    return {
      ok: false,
      message:
        typeof payload.errmsg === "string"
          ? payload.errmsg
          : `TTLock API error (${payload.errcode})`,
    };
  }

  const list = payload.list;
  const total = Array.isArray(list) ? list.length : 0;

  return { ok: true, total };
}
