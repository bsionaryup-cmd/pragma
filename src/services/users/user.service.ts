import type { Prisma, User, UserRole } from "@prisma/client";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import {
  markClerkPublicMetadataRateLimited,
  markClerkPublicMetadataSynced,
  shouldSyncClerkPublicMetadata,
} from "@/lib/clerk-metadata-sync";
import { db } from "@/lib/db";
import {
  rethrowUnlessUserSchemaDrift,
  withUserPreferenceDefaults,
} from "@/services/users/user-prisma-guard";
import { clerkUserPayloadSchema } from "@/lib/validations/user";
import type { ClerkUserPayload } from "@/types/auth";
import type { ClerkWebhookUserData } from "@/types/clerk-webhook";
import { clerkClient } from "@clerk/nextjs/server";

async function resolveRoleForNewUser(): Promise<UserRole> {
  const count = await db.user.count();
  return count === 0 ? "ADMIN" : "RECEPTIONIST";
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
  options?: { touchLogin?: boolean },
): Prisma.UserCreateInput {
  return {
    clerkId: payload.id,
    email: payload.email,
    firstName: payload.firstName,
    lastName: payload.lastName,
    imageUrl: payload.imageUrl,
    role,
    locale: "es",
    theme: "system",
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
  options?: { touchLogin?: boolean; syncClerkMetadata?: boolean },
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
    return withUserPreferenceDefaults(updated);
  }

  const role = await resolveRoleForNewUser();
  let created: User;
  try {
    created = await db.user.create({
      data: buildUserCreateData(validated, role, options),
    });
  } catch (error) {
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

  return db.user.update({
    where: { clerkId },
    data: { isActive: false },
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

export async function listUsers() {
  return db.user.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export async function updateUserRole(userId: string, role: UserRole) {
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

export async function setUserActive(userId: string, isActive: boolean) {
  return db.user.update({
    where: { id: userId },
    data: { isActive },
  });
}

/** @deprecated Usar upsertUserFromClerk */
export async function syncUserFromClerk(payload: ClerkUserPayload) {
  return upsertUserFromClerk(payload, { touchLogin: true });
}
