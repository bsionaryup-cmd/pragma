import { NextResponse } from "next/server";
import {
  isAuthErrorResponse,
  requireTTLockApiAdmin,
} from "@/lib/integrations/ttlock-api-auth";
import { testTTLockConnection } from "@/services/integrations/ttlock/ttlock.service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const authResult = await requireTTLockApiAdmin(request);
  if (isAuthErrorResponse(authResult)) return authResult;

  const result = await testTTLockConnection(
    authResult.auth.dbUserId,
    authResult.request,
  );

  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
