/**
 * Concierge channel ops: Owner platform only (tenants no longer manage AI UI).
 */
import { requireDbUser } from "@/lib/auth";
import { isSuperAdminOwner } from "@/lib/platform/platform-owner";

export async function requireOwnerConciergeOrg(input: {
  organizationId?: string | null;
}): Promise<{ organizationId: string; userId: string }> {
  const user = await requireDbUser();
  if (!isSuperAdminOwner(user)) {
    const err = new Error("FORBIDDEN_OWNER_ONLY");
    (err as Error & { status: number }).status = 403;
    throw err;
  }
  const organizationId = input.organizationId?.trim();
  if (!organizationId) {
    const err = new Error("ORGANIZATION_REQUIRED");
    (err as Error & { status: number }).status = 400;
    throw err;
  }
  return { organizationId, userId: user.id };
}

export function ownerConciergeErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const status =
    typeof error === "object" &&
    error &&
    "status" in error &&
    typeof (error as { status: unknown }).status === "number"
      ? (error as { status: number }).status
      : message.includes("FORBIDDEN")
        ? 403
        : 500;
  return { ok: false as const, error: message, status };
}
