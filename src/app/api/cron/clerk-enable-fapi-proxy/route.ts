import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * One-shot: align Clerk Production domain + FAPI proxy with the live app host
 * (www.pragmapms.com). Apex pragmapms.com 307-redirects to www, so proxy on
 * apex never receives /__clerk traffic.
 *
 * DELETE this route after successful enablement.
 */
function isAuthorized(request: Request): boolean {
  const cron = process.env.CRON_SECRET?.trim();
  const authHeader = request.headers.get("authorization");
  if (cron && authHeader === `Bearer ${cron}`) return true;

  const oneshot = process.env.CLERK_PROXY_ONESHOT_TOKEN?.trim();
  const header = request.headers.get("x-pragma-oneshot")?.trim();
  if (oneshot && header && oneshot === header) return true;

  return false;
}

type ClerkDomain = {
  id: string;
  name: string;
  proxy_url?: string | null;
  frontend_api_url?: string | null;
};

async function clerkFetch(
  secretKey: string,
  path: string,
  init?: RequestInit,
) {
  const res = await fetch(`https://api.clerk.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const body = await res.json().catch(() => null);
  return { res, body };
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const secretKey = process.env.CLERK_SECRET_KEY?.trim();
  if (!secretKey?.startsWith("sk_")) {
    return NextResponse.json(
      { error: "CLERK_SECRET_KEY missing on server" },
      { status: 500 },
    );
  }

  const listed = await clerkFetch(secretKey, "/domains");
  if (!listed.res.ok) {
    return NextResponse.json(
      { error: "Failed to list domains", status: listed.res.status, body: listed.body },
      { status: 502 },
    );
  }

  const domains = (
    Array.isArray(listed.body)
      ? listed.body
      : Array.isArray((listed.body as { data?: ClerkDomain[] } | null)?.data)
        ? (listed.body as { data: ClerkDomain[] }).data
        : []
  ) as ClerkDomain[];

  if (domains.length === 0) {
    return NextResponse.json({ error: "No domains", body: listed.body }, { status: 404 });
  }

  const primary = domains[0];
  const proxyUrl = "https://www.pragmapms.com/__clerk";
  const attempts: Array<Record<string, unknown>> = [];

  // 1) Prefer renaming primary home origin to www (where the app actually lives).
  {
    const patch = await clerkFetch(secretKey, `/domains/${primary.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: "www.pragmapms.com",
        proxy_url: proxyUrl,
        is_secondary: true,
      }),
    });
    attempts.push({
      step: "rename_primary_to_www_with_proxy",
      status: patch.res.status,
      ok: patch.res.ok,
      body: patch.body,
    });
    if (patch.res.ok) {
      return NextResponse.json({ ok: true, mode: "renamed_primary", proxyUrl, attempts });
    }
  }

  // 2) Fallback: set proxy on current primary using www URL (may fail domain check).
  {
    const patch = await clerkFetch(secretKey, `/domains/${primary.id}`, {
      method: "PATCH",
      body: JSON.stringify({ proxy_url: proxyUrl }),
    });
    attempts.push({
      step: "proxy_www_on_existing_primary",
      status: patch.res.status,
      ok: patch.res.ok,
      body: patch.body,
    });
    if (patch.res.ok) {
      return NextResponse.json({ ok: true, mode: "proxy_only", proxyUrl, attempts });
    }
  }

  // 3) Fallback: create www satellite + proxy.
  {
    const created = await clerkFetch(secretKey, "/domains", {
      method: "POST",
      body: JSON.stringify({
        name: "www.pragmapms.com",
        is_satellite: true,
        proxy_url: proxyUrl,
      }),
    });
    attempts.push({
      step: "create_www_satellite",
      status: created.res.status,
      ok: created.res.ok,
      body: created.body,
    });
    if (created.res.ok) {
      return NextResponse.json({ ok: true, mode: "satellite", proxyUrl, attempts });
    }
  }

  return NextResponse.json(
    {
      ok: false,
      domains: domains.map((d) => ({
        id: d.id,
        name: d.name,
        proxy_url: d.proxy_url ?? null,
        frontend_api_url: d.frontend_api_url ?? null,
      })),
      attempts,
    },
    { status: 502 },
  );
}

export async function GET(request: Request) {
  return POST(request);
}
