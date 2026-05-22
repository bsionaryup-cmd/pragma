import { NextResponse } from "next/server";
import { requirePlatformOwnerUser, platformOwnerErrorResponse } from "@/lib/platform/require-platform-owner";
import { listPlatformAuditLogs } from "@/services/platform/platform-audit.service";

export async function GET(request: Request) {
  try {
    await requirePlatformOwnerUser();
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? "50");
    const offset = Number(url.searchParams.get("offset") ?? "0");
    const targetTenantId = url.searchParams.get("targetTenantId") ?? undefined;
    const action = url.searchParams.get("action") ?? undefined;

    const logs = await listPlatformAuditLogs({
      limit,
      offset,
      targetTenantId,
      action,
    });

    return NextResponse.json({ logs });
  } catch (error) {
    return platformOwnerErrorResponse(error);
  }
}
