import { NextResponse } from "next/server";
import { runPriceLabsSyncPipeline } from "@/services/integrations/pricelabs/pricelabs-orchestrator";
import { isPriceLabsConfiguredAsync } from "@/services/integrations/pricelabs/pricelabs-credentials";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  if (request.headers.get("authorization") === `Bearer ${secret}`) return true;
  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret;
}

/** Scheduled PriceLabs sync (Customer API). */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await isPriceLabsConfiguredAsync())) {
    return NextResponse.json({
      ok: false,
      message: "PRICELABS_API_KEY no configurada",
    });
  }

  const result = await runPriceLabsSyncPipeline({
    source: "cron",
    skipConnectionTest: true,
  });

  return NextResponse.json(result);
}
