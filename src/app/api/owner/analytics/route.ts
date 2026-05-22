import { NextResponse } from "next/server";
import { requirePlatformOwnerUser, platformOwnerErrorResponse } from "@/lib/platform/require-platform-owner";
import { getOwnerDashboardAnalytics } from "@/services/platform/owner-dashboard.service";

export async function GET() {
  try {
    await requirePlatformOwnerUser();
    const analytics = await getOwnerDashboardAnalytics();
    return NextResponse.json({ analytics });
  } catch (error) {
    return platformOwnerErrorResponse(error);
  }
}
