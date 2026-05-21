import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import {
  isAuthErrorResponse,
  requireTTLockApiAdmin,
} from "@/lib/integrations/ttlock-api-auth";
import { disconnectTTLock } from "@/services/integrations/ttlock/ttlock.service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const authResult = await requireTTLockApiAdmin(request);
  if (isAuthErrorResponse(authResult)) return authResult;

  await disconnectTTLock(authResult.auth.dbUserId);
  revalidatePath("/integrations/ttlock");
  revalidatePath("/integrations");

  return NextResponse.json({ ok: true });
}
