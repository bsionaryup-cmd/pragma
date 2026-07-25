import { NextResponse } from "next/server";
import { requirePlatformOwnerUser, platformOwnerErrorResponse } from "@/lib/platform/require-platform-owner";
import { buildImpersonationSetCookieHeader } from "@/lib/platform/impersonation-cookie";
import { startTenantImpersonation } from "@/services/platform/tenant-impersonation.service";
import { db } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const user = await requirePlatformOwnerUser();
    const { id } = await context.params;
    const result = await startTenantImpersonation(user, id);

    let retailOnly = false;
    try {
      const [retailStore, propertyCount] = await Promise.all([
        db.retailStore.findFirst({
          where: { organizationId: id, deletedAt: null, status: "ACTIVE" },
          select: { id: true },
        }),
        db.property.count({ where: { organizationId: id } }),
      ]);
      retailOnly = Boolean(retailStore && propertyCount === 0);
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? String((error as { code?: string }).code)
          : "";
      if (code !== "P2021") throw error;
    }
    const redirectUrl = retailOnly ? "/intiendas/dashboard" : "/panel";

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
