import { NextResponse } from "next/server";
import type { User } from "@prisma/client";
import { requireDbUser } from "@/lib/auth";
import { isSuperAdminOwner } from "@/lib/platform/platform-owner";

export async function requirePlatformOwnerUser(): Promise<User> {
  const user = await requireDbUser();
  if (!isSuperAdminOwner(user)) {
    throw new PlatformOwnerForbiddenError();
  }
  return user;
}

export class PlatformOwnerForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "PlatformOwnerForbiddenError";
  }
}

export function platformOwnerErrorResponse(error: unknown) {
  if (error instanceof PlatformOwnerForbiddenError) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (error instanceof Error) {
    const status = error.message.includes("Acceso denegado") ? 403 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}
