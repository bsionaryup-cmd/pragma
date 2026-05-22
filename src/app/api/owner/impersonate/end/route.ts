import { NextResponse } from "next/server";
import { requirePlatformOwnerUser, platformOwnerErrorResponse } from "@/lib/platform/require-platform-owner";
import {
  buildImpersonationClearCookieHeader,
} from "@/lib/platform/impersonation-cookie";
import { readImpersonationSessionIdFromCookies } from "@/lib/platform/impersonation-cookie";
import { endTenantImpersonation } from "@/services/platform/tenant-impersonation.service";

export async function POST() {
  try {
    const user = await requirePlatformOwnerUser();
    const sessionId = await readImpersonationSessionIdFromCookies();
    if (sessionId) {
      await endTenantImpersonation(user, sessionId, "manual_exit");
    }

    const response = NextResponse.json({
      ok: true,
      redirectUrl: "/owner-dashboard",
    });
    response.headers.set("Set-Cookie", buildImpersonationClearCookieHeader());
    return response;
  } catch (error) {
    return platformOwnerErrorResponse(error);
  }
}
