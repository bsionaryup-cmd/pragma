import type { TTLockEnvironment } from "@prisma/client";
import {
  getTTLockKeyboardPwdAddUrl,
  getTTLockKeyboardPwdDeleteUrl,
  getTTLockLockListUrl,
} from "@/lib/integrations/ttlock-config";

export type TTLockApiError = {
  errcode?: number;
  errmsg?: string;
};

export type TTLockRemoteLock = {
  lockId: string;
  lockName: string;
  lockAlias: string | null;
  electricQuantity: number | null;
};

export async function requestTTLockLockList(input: {
  environment: TTLockEnvironment;
  clientId: string;
  accessToken: string;
  pageNo?: number;
  pageSize?: number;
}): Promise<
  | { ok: true; total: number; locks: TTLockRemoteLock[] }
  | { ok: false; message: string }
> {
  const date = Date.now();
  const url = new URL(getTTLockLockListUrl(input.environment));
  url.searchParams.set("clientId", input.clientId);
  url.searchParams.set("accessToken", input.accessToken);
  url.searchParams.set("pageNo", String(input.pageNo ?? 1));
  url.searchParams.set("pageSize", String(input.pageSize ?? 100));
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
  const locks: TTLockRemoteLock[] = Array.isArray(list)
    ? list
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const row = item as Record<string, unknown>;
          const lockId = row.lockId ?? row.lock_id;
          if (lockId == null) return null;
          return {
            lockId: String(lockId),
            lockName:
              typeof row.lockName === "string"
                ? row.lockName
                : typeof row.lock_name === "string"
                  ? row.lock_name
                  : `Lock ${lockId}`,
            lockAlias:
              typeof row.lockAlias === "string"
                ? row.lockAlias
                : typeof row.lock_alias === "string"
                  ? row.lock_alias
                  : null,
            electricQuantity:
              typeof row.electricQuantity === "number"
                ? row.electricQuantity
                : typeof row.electric_quantity === "number"
                  ? row.electric_quantity
                  : null,
          } satisfies TTLockRemoteLock;
        })
        .filter((lock): lock is TTLockRemoteLock => lock !== null)
    : [];

  const total =
    typeof payload.total === "number" ? payload.total : locks.length;

  return { ok: true, total, locks };
}

export async function fetchAllTTLockRemoteLocks(input: {
  environment: TTLockEnvironment;
  clientId: string;
  accessToken: string;
}): Promise<
  | { ok: true; locks: TTLockRemoteLock[] }
  | { ok: false; message: string }
> {
  const pageSize = 100;
  let pageNo = 1;
  let total = 0;
  const locks: TTLockRemoteLock[] = [];

  while (pageNo === 1 || locks.length < total) {
    const result = await requestTTLockLockList({
      ...input,
      pageNo,
      pageSize,
    });
    if (!result.ok) return result;
    total = result.total;
    locks.push(...result.locks);
    if (result.locks.length === 0) break;
    pageNo += 1;
    if (pageNo > 20) break;
  }

  return { ok: true, locks };
}

export async function requestTTLockAddKeyboardPwd(input: {
  environment: TTLockEnvironment;
  clientId: string;
  accessToken: string;
  lockId: number;
  keyboardPwd: string;
  keyboardPwdName: string;
  startDate: number;
  endDate: number;
  addType?: 1 | 2 | 3;
}): Promise<
  { ok: true; keyboardPwdId: number } | { ok: false; message: string }
> {
  const date = Date.now();
  const body = new URLSearchParams();
  body.set("clientId", input.clientId);
  body.set("accessToken", input.accessToken);
  body.set("lockId", String(input.lockId));
  body.set("keyboardPwd", input.keyboardPwd);
  body.set("keyboardPwdName", input.keyboardPwdName);
  body.set("startDate", String(input.startDate));
  body.set("endDate", String(input.endDate));
  body.set("addType", String(input.addType ?? 2));
  body.set("date", String(date));

  const response = await fetch(getTTLockKeyboardPwdAddUrl(input.environment), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
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

  const keyboardPwdId = payload.keyboardPwdId;
  if (typeof keyboardPwdId !== "number") {
    return { ok: false, message: "TTLock no devolvió keyboardPwdId" };
  }

  return { ok: true, keyboardPwdId };
}

export async function requestTTLockDeleteKeyboardPwd(input: {
  environment: TTLockEnvironment;
  clientId: string;
  accessToken: string;
  lockId: number;
  keyboardPwdId: number;
  deleteType?: 1 | 2;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const date = Date.now();
  const body = new URLSearchParams();
  body.set("clientId", input.clientId);
  body.set("accessToken", input.accessToken);
  body.set("lockId", String(input.lockId));
  body.set("keyboardPwdId", String(input.keyboardPwdId));
  body.set("deleteType", String(input.deleteType ?? 2));
  body.set("date", String(date));

  const response = await fetch(getTTLockKeyboardPwdDeleteUrl(input.environment), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
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

  return { ok: true };
}
