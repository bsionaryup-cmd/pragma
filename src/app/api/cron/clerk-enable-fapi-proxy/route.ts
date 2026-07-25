import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Temporary ops endpoint for Clerk Production login restore.
 * DELETE after migration is confirmed and one-shot token removed.
 *
 * Actions:
 * - diagnose (default)
 * - enable (ensure www proxy_url)
 * - migrate-users (Dev → Prod create + remap Prisma clerkId)
 *
 * Auth: Bearer CRON_SECRET or x-pragma-oneshot: CLERK_PROXY_ONESHOT_TOKEN
 * migrate-users also requires header x-pragma-dev-secret: sk_test_…
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

type ClerkUser = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  password_enabled?: boolean;
  public_metadata?: Record<string, unknown>;
  private_metadata?: Record<string, unknown>;
  unsafe_metadata?: Record<string, unknown>;
  email_addresses?: Array<{
    email_address: string;
    verification?: { status?: string } | null;
  }>;
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

async function listAllUsers(secretKey: string): Promise<ClerkUser[]> {
  const out: ClerkUser[] = [];
  let offset = 0;
  for (;;) {
    const page = await clerkFetch(
      secretKey,
      `/users?limit=100&offset=${offset}`,
    );
    if (!page.res.ok) {
      throw new Error(`list users failed: ${page.res.status}`);
    }
    const batch = Array.isArray(page.body)
      ? (page.body as ClerkUser[])
      : Array.isArray((page.body as { data?: ClerkUser[] } | null)?.data)
        ? (page.body as { data: ClerkUser[] }).data
        : [];
    out.push(...batch);
    if (batch.length < 100) break;
    offset += batch.length;
  }
  return out;
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

  if (action === "enable") {
    const listed = await clerkFetch(secretKey, "/domains");
    const domains = (
      Array.isArray(listed.body)
        ? listed.body
        : Array.isArray((listed.body as { data?: ClerkDomain[] } | null)?.data)
          ? (listed.body as { data: ClerkDomain[] }).data
          : []
    ) as ClerkDomain[];
    const primary = domains[0];
    if (!primary) {
      return NextResponse.json({ error: "No domains" }, { status: 404 });
    }
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
      { ok: patch.res.ok, action, status: patch.res.status, body: patch.body },
      { status: patch.res.ok ? 200 : 502 },
    );
  }

  if (action === "migrate-users") {
    const devSecret = request.headers.get("x-pragma-dev-secret")?.trim();
    if (!devSecret?.startsWith("sk_test_")) {
      return NextResponse.json(
        { error: "x-pragma-dev-secret (sk_test_) required" },
        { status: 400 },
      );
    }

    const only = url.searchParams.get("email")?.trim().toLowerCase();
    const tempPassword = url.searchParams.get("temp_password")?.trim();

    let devUsers: ClerkUser[];
    try {
      devUsers = await listAllUsers(devSecret);
    } catch (error) {
      return NextResponse.json(
        {
          error: "Failed listing Development users",
          detail: error instanceof Error ? error.message : String(error),
        },
        { status: 502 },
      );
    }

    if (only) {
      devUsers = devUsers.filter((u) =>
        u.email_addresses?.some(
          (e) => e.email_address.toLowerCase() === only,
        ),
      );
    }

    const results: Array<Record<string, unknown>> = [];

    for (const devUser of devUsers) {
      const email = devUser.email_addresses?.[0]?.email_address;
      if (!email) {
        results.push({ devId: devUser.id, skipped: "no_email" });
        continue;
      }

      const existing = await clerkFetch(
        secretKey,
        `/users?email_address=${encodeURIComponent(email)}&limit=1`,
      );
      const existingData = Array.isArray(existing.body)
        ? (existing.body as ClerkUser[])
        : Array.isArray((existing.body as { data?: ClerkUser[] } | null)?.data)
          ? (existing.body as { data: ClerkUser[] }).data
          : [];

      let prodId = existingData[0]?.id ?? null;

      if (!prodId) {
        const payload: Record<string, unknown> = {
          email_address: [email],
          first_name: devUser.first_name ?? undefined,
          last_name: devUser.last_name ?? undefined,
          public_metadata: devUser.public_metadata ?? {},
          private_metadata: devUser.private_metadata ?? {},
          unsafe_metadata: {
            ...(devUser.unsafe_metadata ?? {}),
            migratedFromDevClerkId: devUser.id,
          },
          skip_password_checks: true,
        };

        if (tempPassword) {
          payload.password = tempPassword;
        } else {
          // Create without password; user must reset once via /forgot-password.
          payload.skip_password_requirement = true;
        }

        const created = await clerkFetch(secretKey, "/users", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        if (!created.res.ok) {
          results.push({
            email,
            devId: devUser.id,
            createStatus: created.res.status,
            createBody: created.body,
          });
          continue;
        }

        prodId = (created.body as { id?: string } | null)?.id ?? null;
      }

      if (!prodId) {
        results.push({ email, devId: devUser.id, error: "no_prod_id" });
        continue;
      }

      // Remap Prisma clerkId so requireDbUser resolves after login.
      const dbUpdated = await db.user.updateMany({
        where: { clerkId: devUser.id },
        data: { clerkId: prodId },
      });
      const dbByEmail = await db.user.updateMany({
        where: { email: email.toLowerCase(), NOT: { clerkId: prodId } },
        data: { clerkId: prodId },
      });

      results.push({
        email,
        devId: devUser.id,
        prodId,
        dbUpdatedByClerkId: dbUpdated.count,
        dbUpdatedByEmail: dbByEmail.count,
        passwordMode: tempPassword ? "temp_password_set" : "reset_required",
      });
    }

    return NextResponse.json({
      ok: true,
      action,
      migrated: results.length,
      results,
      note: tempPassword
        ? "Users created with provided temp_password. Ask them to change it after first login."
        : "Users created without password. They must use /forgot-password once (Clerk cannot export plaintext passwords between instances).",
    });
  }

  // diagnose
  const listed = await clerkFetch(secretKey, "/domains");
  const domains = (
    Array.isArray(listed.body)
      ? listed.body
      : Array.isArray((listed.body as { data?: ClerkDomain[] } | null)?.data)
        ? (listed.body as { data: ClerkDomain[] }).data
        : []
  ) as ClerkDomain[];
  const primary = domains[0];

  const emails = ["urbanovaloft@gmail.com", "bsionaryup@gmail.com"];
  const userChecks: Array<Record<string, unknown>> = [];
  for (const email of emails) {
    const found = await clerkFetch(
      secretKey,
      `/users?email_address=${encodeURIComponent(email)}&limit=5`,
    );
    const data = Array.isArray(found.body)
      ? (found.body as Array<{ id: string }>)
      : Array.isArray((found.body as { data?: Array<{ id: string }> } | null)?.data)
        ? (found.body as { data: Array<{ id: string }> }).data
        : [];
    userChecks.push({ email, status: found.res.status, count: data.length, ids: data.map((u) => u.id) });
  }

  return NextResponse.json({
    ok: true,
    action: "diagnose",
    domain: primary
      ? {
          id: primary.id,
          name: primary.name,
          proxy_url: primary.proxy_url ?? null,
          frontend_api_url: primary.frontend_api_url ?? null,
        }
      : null,
    userChecks,
    secretPrefix: secretKey.slice(0, 8),
  });
}

export async function GET(request: Request) {
  return POST(request);
}
