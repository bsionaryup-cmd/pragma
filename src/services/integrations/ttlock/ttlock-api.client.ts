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
