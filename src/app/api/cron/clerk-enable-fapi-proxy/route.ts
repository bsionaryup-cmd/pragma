import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * One-shot: register https://www.pragmapms.com/__clerk as Clerk Production
 * Frontend API proxy_url so host_invalid stops blocking login.
 *
 * Auth: Authorization Bearer CRON_SECRET, or x-pragma-oneshot header
 * matching CLERK_PROXY_ONESHOT_TOKEN (temporary deploy-time secret).
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
};

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

  const candidates = [
    "https://pragmapms.com/__clerk",
    "https://www.pragmapms.com/__clerk",
  ];

  const listRes = await fetch("https://api.clerk.com/v1/domains", {
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  const listBody = (await listRes.json().catch(() => null)) as
    | { data?: ClerkDomain[] }
    | ClerkDomain[]
    | null;

  if (!listRes.ok) {
    return NextResponse.json(
      { error: "Failed to list Clerk domains", status: listRes.status, body: listBody },
      { status: 502 },
    );
  }

  const domains = Array.isArray(listBody)
    ? listBody
    : Array.isArray(listBody?.data)
      ? listBody.data
      : [];

  if (domains.length === 0) {
    return NextResponse.json({ error: "No Clerk domains found", body: listBody }, { status: 404 });
  }

  const attempts: Array<Record<string, unknown>> = [];

  for (const domain of domains) {
    for (const proxyUrl of candidates) {
      const patchRes = await fetch(`https://api.clerk.com/v1/domains/${domain.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ proxy_url: proxyUrl }),
        cache: "no-store",
      });
      const patchBody = await patchRes.json().catch(() => null);
      attempts.push({
        domainId: domain.id,
        domainName: domain.name,
        proxyUrl,
        status: patchRes.status,
        ok: patchRes.ok,
        body: patchBody,
      });
      if (patchRes.ok) {
        return NextResponse.json({
          ok: true,
          proxyUrl,
          domainId: domain.id,
          domainName: domain.name,
          domains: domains.map((d) => ({ id: d.id, name: d.name, proxy_url: d.proxy_url ?? null })),
          attempts,
        });
      }
    }
  }

  return NextResponse.json(
    {
      ok: false,
      domains: domains.map((d) => ({ id: d.id, name: d.name, proxy_url: d.proxy_url ?? null })),
      attempts,
    },
    { status: 502 },
  );
}

export async function GET(request: Request) {
  return POST(request);
}
