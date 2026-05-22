import { NextResponse } from "next/server";
import { requirePlatformOwnerUser, platformOwnerErrorResponse } from "@/lib/platform/require-platform-owner";
import { getOwnerClientDetail } from "@/services/platform/owner-dashboard.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requirePlatformOwnerUser();
    const { id } = await context.params;
    const tenant = await getOwnerClientDetail(id);
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }
    return NextResponse.json({ tenant });
  } catch (error) {
    return platformOwnerErrorResponse(error);
  }
}
