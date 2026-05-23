import { NextResponse } from "next/server";
import { runPriceLabsCronSyncForAllOrganizations } from "@/services/integrations/pricelabs/pricelabs-orchestrator";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  if (request.headers.get("authorization") === `Bearer ${secret}`) return true;
  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret;
}

/** Scheduled PriceLabs sync (Customer API) — per organization. */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runPriceLabsCronSyncForAllOrganizations();
  return NextResponse.json(result);
}
