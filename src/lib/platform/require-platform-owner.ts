import { NextResponse } from "next/server";
import type { User } from "@prisma/client";
import { currentDbUser } from "@/lib/auth";
import { isSuperAdminOwner } from "@/lib/platform/platform-owner";

export class PlatformOwnerUnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "PlatformOwnerUnauthorizedError";
  }
}

export class PlatformOwnerForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "PlatformOwnerForbiddenError";
  }
}

/**
 * Owner APIs must not call requireDbUser() (it redirects to /login).
 * Resolve the DB user from the Clerk session and enforce platform role.
 */
export async function requirePlatformOwnerUser(): Promise<User> {
  const user = await currentDbUser();
  if (!user) {
    throw new PlatformOwnerUnauthorizedError();
  }
  if (!isSuperAdminOwner(user)) {
    throw new PlatformOwnerForbiddenError();
  }
  return user;
}

export function platformOwnerErrorResponse(error: unknown) {
  if (error instanceof PlatformOwnerUnauthorizedError) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (error instanceof PlatformOwnerForbiddenError) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (error instanceof Error) {
    const status = error.message.includes("Acceso denegado") ? 403 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}
