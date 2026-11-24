import { NextResponse } from "next/server";
import { requirePlatformOwnerUser, platformOwnerErrorResponse } from "@/lib/platform/require-platform-owner";
import { buildImpersonationSetCookieHeader } from "@/lib/platform/impersonation-cookie";
import { startTenantImpersonation } from "@/services/platform/tenant-impersonation.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const user = await requirePlatformOwnerUser();
    const { id } = await context.params;
    const result = await startTenantImpersonation(user, id);

    // PMS is the primary product surface. Never block impersonation on retail schema.
    const redirectUrl = "/panel";

    const response = NextResponse.json({
      ok: true,
      sessionId: result.sessionId,
      organizationName: result.organizationName,
      redirectUrl,
    });
    response.headers.set("Set-Cookie", buildImpersonationSetCookieHeader(result.sessionId));
    return response;
  } catch (error) {
    return platformOwnerErrorResponse(error);
  }
}
