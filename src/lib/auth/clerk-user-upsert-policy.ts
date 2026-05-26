/** Pure helpers for Clerk → Prisma user upsert (testable without server-only). */

export type UserLikeForSignupPolicy = {
  isActive: boolean;
  isAccountOwner: boolean;
  organizationId: string | null;
  clerkId: string;
  deletedAt: Date | null;
};

export function normalizeUserEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function shouldRejectSelfSignupForExistingUser(
  user: UserLikeForSignupPolicy,
  clerkId: string,
): boolean {
  return (
    user.isActive &&
    user.organizationId != null &&
    user.clerkId !== clerkId &&
    !user.isAccountOwner
  );
}

/** Self-signup: miembro eliminado/desactivado debe reinvitarse por admin (como createUserByAdmin). */
export function shouldRejectSelfSignupEmailReuse(
  user: UserLikeForSignupPolicy,
  clerkId: string,
): boolean {
  if (shouldRejectSelfSignupForExistingUser(user, clerkId)) {
    return true;
  }

  if (user.isAccountOwner) {
    return false;
  }

  if (user.deletedAt != null) {
    return true;
  }

  if (!user.isActive && user.organizationId != null) {
    return true;
  }

  return false;
}

export function selfSignupEmailReuseMessage(
  user: Pick<UserLikeForSignupPolicy, "deletedAt" | "isAccountOwner">,
): string {
  if (user.deletedAt != null && !user.isAccountOwner) {
    return "Este correo pertenece a una cuenta eliminada del equipo. Pide al administrador que te vuelva a invitar.";
  }
  return "Este correo ya está registrado en PRAGMA. Inicia sesión para continuar.";
}
