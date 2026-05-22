import type { AppUserRole } from "@/types/auth";

type ClerkPublicMetadata = {
  role?: AppUserRole;
  dbUserId?: string;
};

const VALID_ROLES = new Set<AppUserRole>(["ADMIN", "RECEPTIONIST"]);

export function readPublicMetadata(
  sessionClaims: unknown,
): ClerkPublicMetadata | undefined {
  if (!sessionClaims || typeof sessionClaims !== "object") return undefined;

  const claims = sessionClaims as Record<string, unknown>;
  const raw =
    claims.publicMetadata ?? claims.public_metadata ?? claims.metadata;

  if (!raw || typeof raw !== "object") return undefined;
  return raw as ClerkPublicMetadata;
}

/** Resolves RBAC role from Clerk session claims (supports common JWT shapes). */
export function getRoleFromSessionClaims(
  sessionClaims: unknown,
): AppUserRole | undefined {
  const metadata = readPublicMetadata(sessionClaims);
  if (metadata?.role && VALID_ROLES.has(metadata.role)) {
    return metadata.role;
  }

  if (sessionClaims && typeof sessionClaims === "object") {
    const claims = sessionClaims as Record<string, unknown>;

    const directRole = claims.role;
    if (typeof directRole === "string" && VALID_ROLES.has(directRole as AppUserRole)) {
      return directRole as AppUserRole;
    }

    // Clerk custom session token: { "metadata": { "role": "ADMIN" } }
    const nestedMetadata = claims.metadata;
    if (nestedMetadata && typeof nestedMetadata === "object") {
      const nestedRole = (nestedMetadata as ClerkPublicMetadata).role;
      if (nestedRole && VALID_ROLES.has(nestedRole)) {
        return nestedRole;
      }
    }
  }

  return undefined;
}
