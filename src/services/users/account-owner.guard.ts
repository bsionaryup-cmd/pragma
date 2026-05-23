import { db } from "@/lib/db";

export class AccountOwnerProtectionError extends Error {
  constructor(message = "No se puede modificar al dueño principal de la cuenta") {
    super(message);
    this.name = "AccountOwnerProtectionError";
  }
}

export async function getAccountOwnerUserId(
  organizationId?: string | null,
): Promise<string | null> {
  if (!organizationId) return null;

  const owner = await db.user.findFirst({
    where: { isAccountOwner: true, organizationId },
    select: { id: true },
  });
  return owner?.id ?? null;
}

/** Blocks destructive/admin mutations on the account owner by other users. */
export async function assertAdminCanManageUser(
  targetUserId: string,
  actorUserId: string,
  options?: { allowSelfProfileEdit?: boolean },
) {
  if (targetUserId === actorUserId && options?.allowSelfProfileEdit) {
    return;
  }

  if (targetUserId === actorUserId) {
    throw new Error("No puedes realizar esta acción sobre tu propia cuenta");
  }

  const target = await db.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, isAccountOwner: true },
  });

  if (!target) {
    throw new Error("Usuario no encontrado");
  }

  if (target.isAccountOwner) {
    throw new AccountOwnerProtectionError();
  }
}

export async function assertCanDeleteUser(
  targetUserId: string,
  actorUserId: string,
) {
  if (targetUserId === actorUserId) {
    throw new Error("No puedes eliminar tu propia cuenta");
  }

  const [target, actor] = await Promise.all([
    db.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, isAccountOwner: true, role: true },
    }),
    db.user.findUnique({
      where: { id: actorUserId },
      select: { isAccountOwner: true },
    }),
  ]);

  if (!target || !actor) {
    throw new Error("Usuario no encontrado");
  }

  if (target.isAccountOwner) {
    throw new AccountOwnerProtectionError();
  }

  if (target.role === "ADMIN" && !actor.isAccountOwner) {
    throw new AccountOwnerProtectionError(
      "Solo el dueño de la cuenta puede eliminar administradores",
    );
  }
}

export async function assertAdminCanChangeUserRole(userId: string) {
  const target = await db.user.findUnique({
    where: { id: userId },
    select: { isAccountOwner: true },
  });

  if (!target) {
    throw new Error("Usuario no encontrado");
  }

  if (target.isAccountOwner) {
    throw new AccountOwnerProtectionError(
      "No se puede cambiar el rol del dueño principal de la cuenta",
    );
  }
}
