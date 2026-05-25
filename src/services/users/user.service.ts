import type { Prisma, User, UserRole } from "@prisma/client";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import {
  markClerkPublicMetadataRateLimited,
  markClerkPublicMetadataSynced,
  shouldSyncClerkPublicMetadata,
} from "@/lib/clerk-metadata-sync";
import { db } from "@/lib/db";
import {
  assertAdminCanChangeUserRole,
  AccountOwnerProtectionError,
} from "@/services/users/account-owner.guard";
import {
  rethrowUnlessUserSchemaDrift,
  withUserPreferenceDefaults,
} from "@/services/users/user-prisma-guard";
import { clerkUserPayloadSchema } from "@/lib/validations/user";
import type { ClerkUserPayload } from "@/types/auth";
import type { ClerkWebhookUserData } from "@/types/clerk-webhook";
import { clerkClient } from "@clerk/nextjs/server";
import {
  createOrganizationWithTrialInTransaction,
} from "@/services/organizations/organization.service";
import { resolvePlatformRoleForEmail } from "@/lib/platform/resolve-platform-role";
import { isPlatformOwnerEmail } from "@/lib/platform/platform-owner";
import { assertCanAddUserForOrganization } from "@/lib/billing/plan-limits";
import { assertUsersShareOrganization } from "@/lib/platform/tenant-access";

async function createSelfSignupUser(
  payload: ClerkUserPayload,
  options?: {
    touchLogin?: boolean;
  },
): Promise<User> {
  if (isPlatformOwnerEmail(payload.email)) {
    return db.user.create({
      data: buildUserCreateData(payload, "ADMIN", {
        touchLogin: options?.touchLogin,
        isAccountOwner: false,
        organizationId: null,
      }),
    });
  }

  return db.$transaction(async (tx) => {
    const organization = await createOrganizationWithTrialInTransaction(tx, {
      email: payload.email,
      firstName: payload.firstName,
    });

    return tx.user.create({
      data: buildUserCreateData(payload, "ADMIN", {
        touchLogin: options?.touchLogin,
        isAccountOwner: true,
        organizationId: organization.id,
      }),
    });
  });
}

async function ensurePlatformOwnerTenancy(user: User): Promise<User> {
  if (!isPlatformOwnerEmail(user.email)) return user;
  if (user.organizationId === null && !user.isAccountOwner) return user;

  return db.user.update({
    where: { id: user.id },
    data: { organizationId: null, isAccountOwner: false },
  });
}

function mapWebhookToPayload(data: ClerkWebhookUserData): ClerkUserPayload {
  const primaryEmail = data.email_addresses.find(
    (e) => e.id === data.primary_email_address_id,
  );
  const email =
    primaryEmail?.email_address ?? data.email_addresses[0]?.email_address ?? "";

  return clerkUserPayloadSchema.parse({
    id: data.id,
    email,
    firstName: data.first_name ?? null,
    lastName: data.last_name ?? null,
    imageUrl: data.image_url ?? null,
  });
}

export function mapClerkUserToPayload(user: {
  id: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string;
  emailAddresses: Array<{ emailAddress: string }>;
}): ClerkUserPayload {
  return clerkUserPayloadSchema.parse({
    id: user.id,
    email: user.emailAddresses[0]?.emailAddress ?? "",
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    imageUrl: user.imageUrl || null,
  });
}

function buildUserUpdateData(
  payload: ClerkUserPayload,
  options?: { touchLogin?: boolean },
): Prisma.UserUpdateInput {
  const data: Prisma.UserUpdateInput = {};

  if (payload.email) {
    data.email = payload.email;
    data.platformRole = resolvePlatformRoleForEmail(payload.email);
  }
  if (payload.firstName !== undefined) {
    data.firstName = payload.firstName;
  }
  if (payload.lastName !== undefined) {
    data.lastName = payload.lastName;
  }
  if (payload.imageUrl !== undefined) {
    data.imageUrl = payload.imageUrl;
  }
  if (options?.touchLogin) {
    data.lastLoginAt = new Date();
  }

  return data;
}

function buildUserCreateData(
  payload: ClerkUserPayload,
  role: UserRole,
  options?: {
    touchLogin?: boolean;
    isAccountOwner?: boolean;
    organizationId?: string | null;
  },
): Prisma.UserCreateInput {
  return {
    clerkId: payload.id,
    email: payload.email,
    platformRole: resolvePlatformRoleForEmail(payload.email),
    firstName: payload.firstName,
    lastName: payload.lastName,
    imageUrl: payload.imageUrl,
    role,
    isAccountOwner: options?.isAccountOwner ?? false,
    ...(options?.organizationId
      ? { organization: { connect: { id: options.organizationId } } }
      : {}),
    locale: "es",
    theme: "light",
    timezone: "America/Bogota",
    lastLoginAt: options?.touchLogin ? new Date() : null,
  };
}

export async function syncClerkPublicMetadata(
  clerkId: string,
  metadata: { role: UserRole; dbUserId: string },
) {
  if (!shouldSyncClerkPublicMetadata(clerkId, metadata)) {
    return;
  }

  try {
    const client = await clerkClient();
    await client.users.updateUser(clerkId, {
      publicMetadata: metadata,
    });
    markClerkPublicMetadataSynced(clerkId, metadata);
  } catch (error) {
    if (isClerkAPIResponseError(error) && error.status === 429) {
      markClerkPublicMetadataRateLimited(clerkId);
    }
    console.warn("[clerk] No se pudo sincronizar publicMetadata:", error);
  }
}

/** Upsert idempotente desde webhook o sesión */
export async function upsertUserFromClerk(
  payload: ClerkUserPayload,
  options?: {
    touchLogin?: boolean;
    syncClerkMetadata?: boolean;
    organizationId?: string;
    role?: UserRole;
    isAccountOwner?: boolean;
  },
): Promise<User> {
  const validated = clerkUserPayloadSchema.parse(payload);

  let existing: User | null;
  try {
    existing = await db.user.findUnique({
      where: { clerkId: validated.id },
    });
  } catch (error) {
    rethrowUnlessUserSchemaDrift(error);
  }

  if (existing) {
    const updateData = buildUserUpdateData(validated, options);

    let updated: User;
    try {
      updated =
        Object.keys(updateData).length > 0
          ? await db.user.update({
              where: { clerkId: validated.id },
              data: updateData,
            })
          : existing;
    } catch (error) {
      rethrowUnlessUserSchemaDrift(error);
    }

    if (options?.syncClerkMetadata) {
      await syncClerkPublicMetadata(validated.id, {
        role: updated.role,
        dbUserId: updated.id,
      });
    }
    const normalized = await ensurePlatformOwnerTenancy(updated);
    return withUserPreferenceDefaults(normalized);
  }

  if (options?.organizationId) {
    let created: User;
    try {
      created = await db.user.create({
        data: buildUserCreateData(validated, options.role ?? "RECEPTIONIST", {
          ...options,
          isAccountOwner: options.isAccountOwner ?? false,
          organizationId: options.organizationId,
        }),
      });
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "P2002"
      ) {
        const raced = await db.user.findUnique({
          where: { clerkId: validated.id },
        });
        if (raced) {
          return withUserPreferenceDefaults(raced);
        }
      }
      rethrowUnlessUserSchemaDrift(error);
    }

    await syncClerkPublicMetadata(validated.id, {
      role: created.role,
      dbUserId: created.id,
    });

    return withUserPreferenceDefaults(created);
  }

  let created: User;
  try {
    created = await createSelfSignupUser(validated, options);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      const raced = await db.user.findUnique({
        where: { clerkId: validated.id },
      });
      if (raced) {
        return withUserPreferenceDefaults(raced);
      }
    }
    rethrowUnlessUserSchemaDrift(error);
  }

  await syncClerkPublicMetadata(validated.id, {
    role: created.role,
    dbUserId: created.id,
  });

  return withUserPreferenceDefaults(created);
}

export async function handleUserCreatedWebhook(data: ClerkWebhookUserData) {
  const payload = mapWebhookToPayload(data);
  console.info("[clerk-webhook] user.created", payload.email);
  return upsertUserFromClerk(payload);
}

export async function handleUserUpdatedWebhook(data: ClerkWebhookUserData) {
  const payload = mapWebhookToPayload(data);
  console.info("[clerk-webhook] user.updated", payload.email);
  return upsertUserFromClerk(payload, { syncClerkMetadata: true });
}

export async function handleUserDeletedWebhook(clerkId: string) {
  console.info("[clerk-webhook] user.deleted", clerkId);
  const user = await db.user.findUnique({ where: { clerkId } });
  if (!user) return null;

  if (user.isAccountOwner) {
    console.warn(
      "[clerk-webhook] Refusing to deactivate account owner",
      clerkId,
    );
    return user;
  }

  return db.user.update({
    where: { clerkId },
    data: { isActive: false, deletedAt: new Date() },
  });
}

export async function getUserByClerkId(clerkId: string) {
  try {
    const user = await db.user.findUnique({ where: { clerkId } });
    return user ? withUserPreferenceDefaults(user) : null;
  } catch (error) {
    rethrowUnlessUserSchemaDrift(error);
  }
}

export async function getUserById(id: string) {
  try {
    const user = await db.user.findUnique({ where: { id } });
    return user ? withUserPreferenceDefaults(user) : null;
  } catch (error) {
    rethrowUnlessUserSchemaDrift(error);
  }
}

export async function listUsers(options?: { organizationId?: string | null }) {
  const organizationId = options?.organizationId;
  if (!organizationId) {
    return [];
  }

  return db.user.findMany({
    where: { deletedAt: null, organizationId },
    orderBy: { createdAt: "desc" },
  });
}

export async function updateUserRole(
  userId: string,
  role: UserRole,
  actorUserId: string,
) {
  await assertAdminCanChangeUserRole(userId, actorUserId);

  const user = await db.user.update({
    where: { id: userId },
    data: { role },
  });
  await syncClerkPublicMetadata(user.clerkId, {
    role: user.role,
    dbUserId: user.id,
  });
  return user;
}

export async function setUserActive(
  userId: string,
  isActive: boolean,
  actorUserId: string,
) {
  await assertUsersShareOrganization(actorUserId, userId);

  if (!isActive) {
    const target = await db.user.findUnique({
      where: { id: userId },
      select: { isAccountOwner: true },
    });

    if (target?.isAccountOwner) {
      throw new AccountOwnerProtectionError(
        "No se puede desactivar al dueño principal de la cuenta",
      );
    }
  } else {
    const target = await db.user.findUnique({
      where: { id: userId },
      select: { organizationId: true, isActive: true },
    });
    if (target?.organizationId && !target.isActive) {
      await assertCanAddUserForOrganization(target.organizationId);
    }
  }

  return db.user.update({
    where: { id: userId },
    data: { isActive },
  });
}

async function findClerkUserByEmail(email: string) {
  const client = await clerkClient();
  const list = await client.users.getUserList({
    emailAddress: [email],
    limit: 5,
  });
  const normalized = email.toLowerCase();
  return (
    list.data.find((user) =>
      user.emailAddresses.some(
        (entry) => entry.emailAddress.toLowerCase() === normalized,
      ),
    ) ?? null
  );
}

export async function createUserByAdmin(
  input: {
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    role: UserRole;
    password: string;
  },
  adminUserId: string,
) {
  const admin = await db.user.findUnique({
    where: { id: adminUserId },
    select: { organizationId: true },
  });

  if (!admin?.organizationId) {
    throw new Error("No se pudo determinar la organización del administrador");
  }

  await assertCanAddUserForOrganization(admin.organizationId);

  const email = input.email.trim().toLowerCase();

  const existingDb = await db.user.findFirst({
    where: {
      email: { equals: email, mode: "insensitive" },
      deletedAt: null,
    },
  });
  if (existingDb?.isActive) {
    throw new Error("Ya existe un usuario activo con ese email");
  }

  let clerkUser = await findClerkUserByEmail(email);
  const client = await clerkClient();

  if (!clerkUser) {
    clerkUser = await client.users.createUser({
      emailAddress: [email],
      password: input.password,
      firstName: input.firstName?.trim() || undefined,
      lastName: input.lastName?.trim() || undefined,
      skipPasswordRequirement: false,
      publicMetadata: {
        role: input.role,
        dbUserId: "pending",
      },
    });
  } else {
    clerkUser = await client.users.updateUser(clerkUser.id, {
      password: input.password,
      firstName: input.firstName?.trim() || undefined,
      lastName: input.lastName?.trim() || undefined,
    });
  }

  const payload = mapClerkUserToPayload(clerkUser);

  const deletedDb = await db.user.findFirst({
    where: {
      email: { equals: email, mode: "insensitive" },
      deletedAt: { not: null },
    },
  });

  if (deletedDb) {
    const reactivated = await db.user.update({
      where: { id: deletedDb.id },
      data: {
        clerkId: clerkUser.id,
        email: payload.email,
        firstName: input.firstName?.trim() || payload.firstName,
        lastName: input.lastName?.trim() || payload.lastName,
        imageUrl: payload.imageUrl,
        role: input.role,
        isActive: true,
        deletedAt: null,
        organizationId: admin.organizationId,
      },
    });
    await syncClerkPublicMetadata(clerkUser.id, {
      role: reactivated.role,
      dbUserId: reactivated.id,
    });
    return withUserPreferenceDefaults(reactivated);
  }

  if (existingDb) {
    const reactivated = await db.user.update({
      where: { id: existingDb.id },
      data: {
        clerkId: clerkUser.id,
        email: payload.email,
        firstName: input.firstName?.trim() || payload.firstName,
        lastName: input.lastName?.trim() || payload.lastName,
        imageUrl: payload.imageUrl,
        role: input.role,
        isActive: true,
        organizationId: admin.organizationId,
      },
    });
    await syncClerkPublicMetadata(clerkUser.id, {
      role: reactivated.role,
      dbUserId: reactivated.id,
    });
    return withUserPreferenceDefaults(reactivated);
  }

  const created = await db.user.create({
    data: buildUserCreateData(
      payload,
      input.role,
      { organizationId: admin.organizationId },
    ),
  });

  await syncClerkPublicMetadata(clerkUser.id, {
    role: created.role,
    dbUserId: created.id,
  });

  return withUserPreferenceDefaults(created);
}

export async function updateUserProfile(
  userId: string,
  input: { firstName?: string | null; lastName?: string | null },
  actorUserId: string,
) {
  await assertUsersShareOrganization(actorUserId, userId);

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error("Usuario no encontrado");
  }

  const firstName = input.firstName?.trim() || null;
  const lastName = input.lastName?.trim() || null;

  const client = await clerkClient();
  await client.users.updateUser(user.clerkId, {
    firstName: firstName ?? undefined,
    lastName: lastName ?? undefined,
  });

  const updated = await db.user.update({
    where: { id: userId },
    data: { firstName, lastName },
  });

  return withUserPreferenceDefaults(updated);
}

export async function deleteUserByAdmin(userId: string, actorUserId: string) {
  await assertUsersShareOrganization(actorUserId, userId);

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error("Usuario no encontrado");
  }

  if (user.isAccountOwner) {
    throw new AccountOwnerProtectionError(
      "No se puede eliminar al dueño principal de la cuenta",
    );
  }

  const client = await clerkClient();
  try {
    await client.users.deleteUser(user.clerkId);
  } catch (error) {
    if (!isClerkAPIResponseError(error) || error.status !== 404) {
      throw error;
    }
  }

  return db.user.update({
    where: { id: userId },
    data: { isActive: false, deletedAt: new Date() },
  });
}

/** @deprecated Usar upsertUserFromClerk */
export async function syncUserFromClerk(payload: ClerkUserPayload) {
  return upsertUserFromClerk(payload, { touchLogin: true });
}
