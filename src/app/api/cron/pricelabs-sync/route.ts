import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { runPriceLabsCronSyncForAllOrganizations } from "@/services/integrations/pricelabs/pricelabs-orchestrator";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Scheduled PriceLabs sync (Customer API) — per organization. */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runPriceLabsCronSyncForAllOrganizations();
  return NextResponse.json(result);
}
