import { NextResponse } from "next/server";
import {
  isAuthErrorResponse,
  requireTTLockApiAdmin,
} from "@/lib/integrations/ttlock-api-auth";
import { getTTLockStatusPayload } from "@/services/integrations/ttlock/ttlock.service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authResult = await requireTTLockApiAdmin(request);
  if (isAuthErrorResponse(authResult)) return authResult;

  const status = await getTTLockStatusPayload(authResult.auth.dbUserId);
  return NextResponse.json(status);
}
