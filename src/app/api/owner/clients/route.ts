import { NextResponse } from "next/server";
import { requirePlatformOwnerUser, platformOwnerErrorResponse } from "@/lib/platform/require-platform-owner";
import {
  getOwnerDashboardAnalytics,
  listOwnerClients,
  type OwnerClientsQuery,
} from "@/services/platform/owner-dashboard.service";

export async function GET(request: Request) {
  try {
    await requirePlatformOwnerUser();
    const url = new URL(request.url);
    const query: OwnerClientsQuery = {
      search: url.searchParams.get("search") ?? undefined,
      status: (url.searchParams.get("status") as OwnerClientsQuery["status"]) ?? "ALL",
      plan: (url.searchParams.get("plan") as OwnerClientsQuery["plan"]) ?? "ALL",
      billingStatus:
        (url.searchParams.get("billingStatus") as OwnerClientsQuery["billingStatus"]) ??
        "ALL",
      sortBy: (url.searchParams.get("sortBy") as OwnerClientsQuery["sortBy"]) ?? "createdAt",
      sortDir: (url.searchParams.get("sortDir") as "asc" | "desc") ?? "desc",
      page: Number(url.searchParams.get("page") ?? "1"),
      pageSize: Number(url.searchParams.get("pageSize") ?? "20"),
    };

    const [clients, analytics] = await Promise.all([
      listOwnerClients(query),
      getOwnerDashboardAnalytics(),
    ]);

    return NextResponse.json({ clients, analytics });
  } catch (error) {
    return platformOwnerErrorResponse(error);
  }
}
