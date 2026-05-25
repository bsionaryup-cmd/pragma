import {
  getTraaApiBaseUrl,
  getTraaPrimaryApiPath,
  isTraaTestPayloadEnabled,
} from "@/lib/integrations/traa-config";
import { traaFetch, TraaHttpError } from "./traa-http";

export type TraaApiCredentials = {
  /** Número RNT del establecimiento. */
  rnt: string;
  token: string;
};

export type TraaApiTestResult =
  | { ok: true; message: string; httpStatus: number }
  | { ok: false; message: string; httpStatus?: number };

/** Header oficial MINCIT: `Authorization: token <TOKEN>` (no Bearer). */
export function buildTraaAuthorizationHeader(token: string): string {
  const trimmed = token.trim();
  if (/^token\s+/i.test(trimmed)) return trimmed;
  return `token ${trimmed}`;
}

export function extractTraaApiDetail(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (typeof record.detail === "string") return record.detail.trim();
  if (Array.isArray(record.detail) && record.detail.length > 0) {
    const first = record.detail[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object" && "msg" in first) {
      return String((first as { msg: unknown }).msg);
    }
  }
  if (typeof record.message === "string") return record.message.trim();
  return null;
}

export function isTraaTokenRejected(
  status: number,
  payload: unknown,
): boolean {
  if (status !== 401 && status !== 403) return false;
  const detail = extractTraaApiDetail(payload)?.toLowerCase() ?? "";
  return (
    detail.includes("token inválido") ||
    detail.includes("token invalido") ||
    detail.includes("no se proveyeron") ||
    detail.includes("credenciales")
  );
}

/** Token aceptado: la API respondió sin rechazo de autenticación (p. ej. 400 por campos). */
export function isTraaTokenAccepted(status: number, payload: unknown): boolean {
  if (isTraaTokenRejected(status, payload)) return false;
  if (status >= 500) return false;
  return status < 500;
}

function buildMinimalTestBody(rnt: string): Record<string, string> {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  return {
    tipo_identificacion: "C.C",
    numero_identificacion: "00000000",
    nombres: "PRAGMA",
    apellidos: "TEST_CONEXION",
    cuidad_residencia: "Bogota",
    cuidad_procedencia: "Bogota",
    numero_habitacion: "000",
    motivo: "Turismo",
    numero_acompanantes: "0",
    check_in: fmt(today),
    check_out: fmt(tomorrow),
    tipo_acomodacion: "Hotel",
    costo: "0",
    nombre_establecimiento: "PRAGMA_TEST",
    rnt_establecimiento: rnt,
  };
}

function resolveTestBody(rnt: string): string {
  const raw = process.env.TRAA_TEST_PAYLOAD_JSON?.trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (!parsed.rnt_establecimiento) parsed.rnt_establecimiento = rnt;
      return JSON.stringify(parsed);
    } catch {
      throw new TraaHttpError(
        "TRAA_TEST_PAYLOAD_JSON no es JSON válido",
        "PARSE",
      );
    }
  }
  if (isTraaTestPayloadEnabled()) {
    return JSON.stringify(buildMinimalTestBody(rnt));
  }
  return "{}";
}

export async function testTraaApiConnection(
  credentials: TraaApiCredentials,
): Promise<TraaApiTestResult> {
  const rnt = credentials.rnt.trim();
  const token = credentials.token.trim();

  if (!rnt || !token) {
    return {
      ok: false,
      message:
        "Configura Client ID (número RNT) y Token (autogestionado en pms.mincit.gov.co/token) antes de probar",
    };
  }

  const baseUrl = getTraaApiBaseUrl();
  const url = `${baseUrl}${getTraaPrimaryApiPath()}`;

  const response = await traaFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: buildTraaAuthorizationHeader(token),
    },
    body: resolveTestBody(rnt),
  });

  const payload = (await response.json().catch(() => ({}))) as unknown;
  const detail = extractTraaApiDetail(payload);

  if (isTraaTokenRejected(response.status, payload)) {
    return {
      ok: false,
      message: detail ?? "Token TRAA inválido o credenciales no aceptadas",
      httpStatus: response.status,
    };
  }

  if (response.status >= 500) {
    throw new TraaHttpError(
      detail ?? `TRAA API respondió con error ${response.status}`,
      "HTTP",
      { status: response.status },
    );
  }

  if (!isTraaTokenAccepted(response.status, payload)) {
    return {
      ok: false,
      message: detail ?? `TRAA API rechazó la conexión (HTTP ${response.status})`,
      httpStatus: response.status,
    };
  }

  const suffix =
    response.status >= 400
      ? " (token válido; la API respondió con validación de campos)"
      : "";
  return {
    ok: true,
    httpStatus: response.status,
    message: `Conexión validada con TRA/MINCIT (RNT ${rnt})${suffix}`,
  };
}
