import { NextResponse } from "next/server";
import {
  requirePlatformOwnerUser,
  platformOwnerErrorResponse,
} from "@/lib/platform/require-platform-owner";
import { applyImpersonationCookie } from "@/lib/platform/impersonation-cookie";
import { startTenantImpersonation } from "@/services/platform/tenant-impersonation.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const user = await requirePlatformOwnerUser();
    const { id } = await context.params;
    const result = await startTenantImpersonation(user, id);

    // Bridge verifies the HttpOnly cookie before /panel so a missing cookie
    // cannot silently open the Owner's own tenant PMS.
    const response = NextResponse.json({
      ok: true,
      sessionId: result.sessionId,
      organizationName: result.organizationName,
      redirectUrl: "/auth/impersonation/continue",
    });
    applyImpersonationCookie(response, result.sessionId);
    return response;
  } catch (error) {
    return platformOwnerErrorResponse(error);
  }
}
