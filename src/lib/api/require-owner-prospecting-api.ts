import type { User } from "@prisma/client";
import { NextResponse } from "next/server";
import {
  platformOwnerErrorResponse,
  requirePlatformOwnerUser,
} from "@/lib/platform/require-platform-owner";

export type OwnerProspectingApiAuthResult =
  | { ok: true; user: User }
  | { ok: false; response: NextResponse };

const TENANT_PROSPECTING_RETIRED_MESSAGE =
  "La prospección está disponible solo en el panel del propietario (/owner-dashboard/sales).";

/** Tenant CRM APIs are retired — owner sales console is the supported path. */
export function tenantProspectingApiRetiredResponse(): NextResponse {
  return NextResponse.json(
    { success: false, error: TENANT_PROSPECTING_RETIRED_MESSAGE },
    { status: 403 },
  );
}

/** Prospecting is owner-dashboard only — tenants must not access APIs. */
export async function resolveOwnerProspectingApiAuth(): Promise<OwnerProspectingApiAuthResult> {
  try {
    const user = await requirePlatformOwnerUser();
    return { ok: true, user };
  } catch (error) {
    return { ok: false, response: platformOwnerErrorResponse(error) };
  }
}
