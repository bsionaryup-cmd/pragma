import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Temporary ops endpoint for Clerk Production login restore.
 * DELETE after migration/proxy work is confirmed.
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

async function clerkFetch(secretKey: string, path: string, init?: RequestInit) {
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

  const url = new URL(request.url);
  const action = url.searchParams.get("action") ?? "diagnose";

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

  if (action === "enable") {
    const proxyUrl = "https://www.pragmapms.com/__clerk";
    const patch = await clerkFetch(secretKey, `/domains/${primary.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: "www.pragmapms.com",
        proxy_url: proxyUrl,
        is_secondary: true,
      }),
    });
    return NextResponse.json(
      {
        ok: patch.res.ok,
        action,
        status: patch.res.status,
        body: patch.body,
      },
      { status: patch.res.ok ? 200 : 502 },
    );
  }

  const emails = ["urbanovaloft@gmail.com", "bsionaryup@gmail.com"];
  const userChecks: Array<Record<string, unknown>> = [];
  for (const email of emails) {
    const found = await clerkFetch(
      secretKey,
      `/users?email_address=${encodeURIComponent(email)}&limit=5`,
    );
    const data = Array.isArray((found.body as { data?: unknown[] } | null)?.data)
      ? (found.body as { data: Array<{ id: string }> }).data
      : Array.isArray(found.body)
        ? (found.body as Array<{ id: string }>)
        : [];
    userChecks.push({
      email,
      status: found.res.status,
      count: data.length,
      ids: data.map((u) => u.id).slice(0, 3),
    });
  }

  const total = await clerkFetch(secretKey, "/users?limit=1");
  const totalCount =
    typeof (total.body as { total_count?: number } | null)?.total_count === "number"
      ? (total.body as { total_count: number }).total_count
      : null;

  return NextResponse.json({
    ok: true,
    action: "diagnose",
    domain: {
      id: primary.id,
      name: primary.name,
      proxy_url: primary.proxy_url ?? null,
      frontend_api_url: primary.frontend_api_url ?? null,
    },
    totalUsers: totalCount,
    userChecks,
    secretPrefix: secretKey.slice(0, 8),
  });
}

export async function GET(request: Request) {
  return POST(request);
}
