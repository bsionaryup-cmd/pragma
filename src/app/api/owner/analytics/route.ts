import { NextResponse } from "next/server";
import { requirePlatformOwnerUser, platformOwnerErrorResponse } from "@/lib/platform/require-platform-owner";
import { getOwnerDashboardSnapshot } from "@/services/platform/owner-dashboard.service";

export async function GET() {
  try {
    await requirePlatformOwnerUser();
    const snapshot = await getOwnerDashboardSnapshot();
    return NextResponse.json({ analytics: snapshot.analytics, snapshot });
  } catch (error) {
    return platformOwnerErrorResponse(error);
  }
}
