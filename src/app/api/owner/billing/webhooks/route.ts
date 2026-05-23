import { NextResponse } from "next/server";
import {
  platformOwnerErrorResponse,
  requirePlatformOwnerUser,
} from "@/lib/platform/require-platform-owner";
import { getOwnerBillingInfraSnapshot } from "@/services/platform/owner-billing-infra.service";

export async function GET() {
  try {
    await requirePlatformOwnerUser();
    const snapshot = await getOwnerBillingInfraSnapshot();
    return NextResponse.json({
      webhooks: snapshot.recentWebhooks,
      stats: snapshot.webhookStats,
    });
  } catch (error) {
    return platformOwnerErrorResponse(error);
  }
}
