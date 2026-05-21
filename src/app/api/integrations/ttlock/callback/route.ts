import { NextResponse } from "next/server";
import { handleTTLockOAuthCallback } from "@/services/integrations/ttlock/ttlock.service";
import {
  PRAGMA_CANONICAL_TTLOCK_CALLBACK,
  TTLOCK_CALLBACK_PATH,
} from "@/lib/integrations/ttlock-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_METHODS = "GET, POST, HEAD, OPTIONS";

type OAuthParams = {
  code: string | null;
  state: string | null;
  error: string | null;
  errorDescription: string | null;
  hasOAuthParams: boolean;
};

function ttlockHealthResponse(): NextResponse {
  return NextResponse.json(
    {
      ok: true,
      provider: "ttlock",
      callback: "ready",
      service: "ttlock-oauth-callback",
      path: TTLOCK_CALLBACK_PATH,
      canonical: PRAGMA_CANONICAL_TTLOCK_CALLBACK,
    },
    { status: 200 },
  );
}

function ttlockHeadResponse(): NextResponse {
  return new NextResponse(null, {
    status: 200,
    headers: {
      Allow: ALLOWED_METHODS,
      "Content-Type": "application/json",
    },
  });
}

function ttlockOptionsResponse(): NextResponse {
  return new NextResponse(null, {
    status: 200,
    headers: {
      Allow: ALLOWED_METHODS,
      "Access-Control-Allow-Methods": ALLOWED_METHODS,
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Max-Age": "86400",
    },
  });
}

function pickParam(
  primary: string | null,
  fallback: FormDataEntryValue | null | undefined,
): string | null {
  if (primary?.trim()) return primary.trim();
  if (fallback == null) return null;
  const value = String(fallback).trim();
  return value || null;
}

async function readPostOAuthParams(request: Request): Promise<Partial<OAuthParams>> {
  const contentType = request.headers.get("content-type") ?? "";
  const contentLength = Number(request.headers.get("content-length") ?? "0");

  if (!contentLength && !contentType) {
    return {};
  }

  try {
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as Record<string, unknown>;
      return {
        code: typeof body.code === "string" ? body.code : null,
        state: typeof body.state === "string" ? body.state : null,
        error: typeof body.error === "string" ? body.error : null,
        errorDescription:
          typeof body.error_description === "string"
            ? body.error_description
            : typeof body.errorDescription === "string"
              ? body.errorDescription
              : null,
      };
    }

    if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      const form = await request.formData();
      return {
        code: pickParam(null, form.get("code")),
        state: pickParam(null, form.get("state")),
        error: pickParam(null, form.get("error")),
        errorDescription: pickParam(
          null,
          form.get("error_description") ?? form.get("errorDescription"),
        ),
      };
    }

    const text = (await request.text()).trim();
    if (!text) return {};

    if (text.startsWith("{")) {
      const body = JSON.parse(text) as Record<string, unknown>;
      return {
        code: typeof body.code === "string" ? body.code : null,
        state: typeof body.state === "string" ? body.state : null,
        error: typeof body.error === "string" ? body.error : null,
        errorDescription:
          typeof body.error_description === "string"
            ? body.error_description
            : null,
      };
    }

    const params = new URLSearchParams(text);
    return {
      code: params.get("code"),
      state: params.get("state"),
      error: params.get("error"),
      errorDescription: params.get("error_description"),
    };
  } catch {
    return {};
  }
}

async function resolveOAuthParams(request: Request): Promise<OAuthParams> {
  const url = new URL(request.url);

  let code = url.searchParams.get("code");
  let state = url.searchParams.get("state");
  let error = url.searchParams.get("error");
  let errorDescription = url.searchParams.get("error_description");

  if (request.method === "POST") {
    const fromBody = await readPostOAuthParams(request);
    code = pickParam(code, fromBody.code);
    state = pickParam(state, fromBody.state);
    error = pickParam(error, fromBody.error);
    errorDescription = pickParam(errorDescription, fromBody.errorDescription);
  }

  const hasOAuthParams = Boolean(
    code?.trim() || state?.trim() || error?.trim(),
  );

  return {
    code,
    state,
    error,
    errorDescription,
    hasOAuthParams,
  };
}

async function handleCallbackRequest(request: Request): Promise<NextResponse> {
  const params = await resolveOAuthParams(request);

  if (!params.hasOAuthParams) {
    return ttlockHealthResponse();
  }

  const { redirectPath } = await handleTTLockOAuthCallback({
    code: params.code,
    state: params.state,
    error: params.error,
    errorDescription: params.errorDescription,
  });

  if (request.method === "POST") {
    return NextResponse.json(
      {
        ok: true,
        provider: "ttlock",
        callback: "oauth_processed",
        redirect: redirectPath,
      },
      { status: 200 },
    );
  }

  return NextResponse.redirect(new URL(redirectPath, request.url));
}

export async function GET(request: Request) {
  return handleCallbackRequest(request);
}

export async function POST(request: Request) {
  return handleCallbackRequest(request);
}

export async function HEAD() {
  return ttlockHeadResponse();
}

export async function OPTIONS() {
  return ttlockOptionsResponse();
}
