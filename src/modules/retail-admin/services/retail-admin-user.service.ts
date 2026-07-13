import "server-only";

import { createClerkClient } from "@clerk/backend";
import { Prisma, type RetailAccessPlan, type User } from "@prisma/client";
import { getClerkAuthErrorMessage } from "@/lib/clerk-auth-errors";
import { db } from "@/lib/db";
import {
  mapClerkUserToPayload,
  syncClerkPublicMetadata,
} from "@/services/users/user.service";
import { writeRetailAdminPlatformAudit } from "./retail-admin-audit.service";

function clerk() {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) throw new Error("CLERK_SECRET_KEY no configurado");
  return createClerkClient({ secretKey });
}

function normalizeEmail(email: string) {
  const value = email.trim().toLowerCase();
  if (!value.includes("@")) throw new Error("Correo inválido");
  return value;
}

function normalizePassword(password: string) {
  if (password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres");
  return password;
}

function normalizeAmount(amount: number) {
  if (!Number.isFinite(amount) || amount < 0) throw new Error("Monto inválido");
  return Math.round(amount * 100) / 100;
}

function isRealClerkUserId(clerkId: string) {
  return clerkId.startsWith("user_");
}

function retailAccountError(error: unknown, fallback: string): Error {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return new Error(
      "Ese correo ya está registrado. Si lo eliminaste antes, vuelve a crearlo con el mismo correo para reactivarlo, o usa otro correo.",
    );
  }
  return new Error(getClerkAuthErrorMessage(error, fallback));
}

async function ensureClerkUserForEmail(input: {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  existingClerkId?: string | null;
}) {
  const client = clerk();
  const list = await client.users.getUserList({ emailAddress: [input.email], limit: 1 });
  let clerkUser: Awaited<ReturnType<typeof client.users.getUser>> | null =
    list.data[0] ?? null;

  if (
    !clerkUser &&
    input.existingClerkId &&
    isRealClerkUserId(input.existingClerkId)
  ) {
    try {
      clerkUser = await client.users.getUser(input.existingClerkId);
    } catch {
      clerkUser = null;
    }
  }

  try {
    if (!clerkUser) {
      return await client.users.createUser({
        emailAddress: [input.email],
        password: input.password,
        firstName: input.firstName?.trim() || undefined,
        lastName: input.lastName?.trim() || undefined,
        skipPasswordChecks: false,
        publicMetadata: { role: "ADMIN", dbUserId: "pending", product: "intiendas" },
      });
    }

    return await client.users.updateUser(clerkUser.id, {
      password: input.password,
      firstName: input.firstName?.trim() || undefined,
      lastName: input.lastName?.trim() || undefined,
    });
  } catch (error) {
    throw retailAccountError(
      error,
      "No se pudo crear el acceso en Clerk. Revisa el correo y usa una contraseña más segura (mín. 8 caracteres).",
    );
  }
}

export type RetailAccountListItem = {
  id: string;
  clerkId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  deletedAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  organizationId: string | null;
  storeId: string | null;
  storeName: string | null;
  storeStatus: "ACTIVE" | "INACTIVE" | null;
  accessPlan: RetailAccessPlan | null;
  billingAmount: number;
  accountLabel: string;
};

export async function listRetailAccounts(options: { q?: string } = {}) {
  const stores = await db.retailStore.findMany({
    select: {
      id: true,
      name: true,
      organizationId: true,
      ownerUserId: true,
      status: true,
      deletedAt: true,
      accessPlan: true,
      billingAmount: true,
    },
    orderBy: { createdAt: "desc" },
  });
  if (stores.length === 0) return [];

  const organizationIds = stores.map((store) => store.organizationId);
  const ownerIds = stores.map((s) => s.ownerUserId).filter(Boolean) as string[];
  const users = await db.user.findMany({
    where: {
      OR: [
        { organizationId: { in: organizationIds } },
        ...(ownerIds.length ? [{ id: { in: ownerIds } }] : []),
      ],
      ...(options.q?.trim()
        ? {
            AND: [
              {
                OR: [
                  { email: { contains: options.q.trim(), mode: "insensitive" } },
                  { firstName: { contains: options.q.trim(), mode: "insensitive" } },
                  { lastName: { contains: options.q.trim(), mode: "insensitive" } },
                  { companyName: { contains: options.q.trim(), mode: "insensitive" } },
                ],
              },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      clerkId: true,
      email: true,
      firstName: true,
      lastName: true,
      companyName: true,
      isActive: true,
      deletedAt: true,
      lastLoginAt: true,
      createdAt: true,
      organizationId: true,
      isAccountOwner: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const storeByOrg = new Map(stores.map((store) => [store.organizationId, store]));
  const storeByOwner = new Map(
    stores.filter((s) => s.ownerUserId).map((store) => [store.ownerUserId!, store]),
  );

  const rows: RetailAccountListItem[] = users
    .filter((user) => user.isAccountOwner || storeByOwner.has(user.id))
    .map((user) => {
      const store =
        (user.organizationId ? storeByOrg.get(user.organizationId) : undefined) ??
        storeByOwner.get(user.id) ??
        null;
      return {
        id: user.id,
        clerkId: user.clerkId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isActive: user.isActive && !user.deletedAt && store?.status === "ACTIVE" && !store.deletedAt,
        deletedAt: user.deletedAt,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        organizationId: user.organizationId,
        storeId: store?.id ?? null,
        storeName: store?.name ?? user.companyName ?? null,
        storeStatus: store ? (store.deletedAt ? "INACTIVE" : store.status) : null,
        accessPlan: store?.accessPlan ?? null,
        billingAmount: store ? Number(store.billingAmount) : 0,
        accountLabel:
          !user.isActive || user.deletedAt || store?.deletedAt || store?.status === "INACTIVE"
            ? "Inactivo"
            : "Activo",
      };
    });

  const query = options.q?.trim().toLocaleLowerCase("es");
  return query
    ? rows.filter(
        (row) =>
          row.email.toLocaleLowerCase("es").includes(query) ||
          (row.storeName?.toLocaleLowerCase("es").includes(query) ?? false) ||
          `${row.firstName ?? ""} ${row.lastName ?? ""}`.toLocaleLowerCase("es").includes(query),
      )
    : rows;
}

async function reactivateRetailAccount(input: {
  platformUser: User;
  existingUserId: string;
  businessName: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  accessPlan: RetailAccessPlan;
  billingAmount: number;
}) {
  const existing = await db.user.findUnique({
    where: { id: input.existingUserId },
    select: {
      id: true,
      clerkId: true,
      email: true,
      organizationId: true,
      isAccountOwner: true,
    },
  });
  if (!existing) throw new Error("Usuario no encontrado");

  const store = existing.organizationId
    ? await db.retailStore.findUnique({
        where: { organizationId: existing.organizationId },
        select: { id: true, organizationId: true },
      })
    : null;

  if (!store) {
    throw new Error(
      "Ese correo pertenece a otra cuenta del sistema. Usa un correo distinto para INTIENDAS.",
    );
  }

  const clerkUser = await ensureClerkUserForEmail({
    email: input.email,
    password: input.password,
    firstName: input.firstName,
    lastName: input.lastName,
    existingClerkId: existing.clerkId,
  });
  const payload = mapClerkUserToPayload(clerkUser);

  const result = await db.$transaction(async (tx) => {
    await tx.organization.update({
      where: { id: store.organizationId },
      data: { name: input.businessName },
    });

    const user = await tx.user.update({
      where: { id: existing.id },
      data: {
        clerkId: payload.id,
        email: payload.email,
        firstName: input.firstName?.trim() || payload.firstName,
        lastName: input.lastName?.trim() || payload.lastName,
        imageUrl: payload.imageUrl,
        role: "ADMIN",
        isAccountOwner: true,
        isActive: true,
        deletedAt: null,
        companyName: input.businessName,
        organizationId: store.organizationId,
        onboardingCompletedAt: new Date(),
      },
    });

    const storeRow = await tx.retailStore.update({
      where: { id: store.id },
      data: {
        name: input.businessName,
        ownerUserId: user.id,
        createdByUserId: input.platformUser.id,
        accessPlan: input.accessPlan,
        billingAmount: input.billingAmount,
        status: "ACTIVE",
        deletedAt: null,
      },
    });

    await tx.retailAuditLog.create({
      data: {
        storeId: storeRow.id,
        action: "admin_account_reactivate",
        entityType: "RetailAccount",
        entityId: user.id,
        actorUserId: input.platformUser.id,
        metadata: { accessPlan: input.accessPlan, billingAmount: input.billingAmount },
      },
    });

    const organization = await tx.organization.findUniqueOrThrow({
      where: { id: store.organizationId },
    });

    return { user, store: storeRow, organization };
  });

  await syncClerkPublicMetadata(clerkUser.id, {
    role: "ADMIN",
    dbUserId: result.user.id,
  });

  await writeRetailAdminPlatformAudit({
    platformUser: input.platformUser,
    action: "retail_account_reactivate",
    organizationId: result.organization.id,
    targetUserId: result.user.id,
    metadata: {
      storeId: result.store.id,
      accessPlan: input.accessPlan,
      billingAmount: input.billingAmount,
    },
  });

  return result;
}

export async function createRetailAccount(input: {
  platformUser: User;
  businessName: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  accessPlan: RetailAccessPlan;
  billingAmount: number;
}) {
  const email = normalizeEmail(input.email);
  const password = normalizePassword(input.password);
  const businessName = input.businessName.trim();
  if (!businessName) throw new Error("El nombre del negocio es obligatorio");
  const billingAmount = normalizeAmount(input.billingAmount);

  const existing = await db.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: {
      id: true,
      isActive: true,
      deletedAt: true,
      organizationId: true,
      isAccountOwner: true,
    },
  });

  if (existing && existing.isActive && !existing.deletedAt) {
    throw new Error(
      "Ya existe un usuario activo con ese correo. Usa otro correo o edita el usuario existente.",
    );
  }

  if (existing && (!existing.isActive || existing.deletedAt)) {
    return reactivateRetailAccount({
      platformUser: input.platformUser,
      existingUserId: existing.id,
      businessName,
      email,
      password,
      firstName: input.firstName,
      lastName: input.lastName,
      accessPlan: input.accessPlan,
      billingAmount,
    });
  }

  let clerkUser;
  try {
    clerkUser = await ensureClerkUserForEmail({
      email,
      password,
      firstName: input.firstName,
      lastName: input.lastName,
    });
  } catch (error) {
    throw retailAccountError(
      error,
      "No se pudo crear el acceso. Revisa el correo y la contraseña.",
    );
  }

  const payload = mapClerkUserToPayload(clerkUser);

  let result;
  try {
    result = await db.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: { name: businessName },
      });

      const user = await tx.user.create({
        data: {
          clerkId: payload.id,
          email: payload.email,
          firstName: input.firstName?.trim() || payload.firstName,
          lastName: input.lastName?.trim() || payload.lastName,
          imageUrl: payload.imageUrl,
          role: "ADMIN",
          isAccountOwner: true,
          isActive: true,
          companyName: businessName,
          organizationId: organization.id,
          onboardingCompletedAt: new Date(),
        },
      });

      const store = await tx.retailStore.create({
        data: {
          organizationId: organization.id,
          name: businessName,
          createdByUserId: input.platformUser.id,
          ownerUserId: user.id,
          accessPlan: input.accessPlan,
          billingAmount,
          status: "ACTIVE",
        },
      });

      await tx.retailCashRegister.create({
        data: { storeId: store.id, name: "Caja 1" },
      });

      await tx.retailAuditLog.create({
        data: {
          storeId: store.id,
          action: "admin_account_create",
          entityType: "RetailAccount",
          entityId: user.id,
          actorUserId: input.platformUser.id,
          metadata: { accessPlan: input.accessPlan, billingAmount },
        },
      });

      return { user, store, organization };
    });
  } catch (error) {
    throw retailAccountError(error, "No se pudo guardar el usuario en la base de datos.");
  }

  await syncClerkPublicMetadata(clerkUser.id, {
    role: "ADMIN",
    dbUserId: result.user.id,
  });

  await writeRetailAdminPlatformAudit({
    platformUser: input.platformUser,
    action: "retail_account_create",
    organizationId: result.organization.id,
    targetUserId: result.user.id,
    metadata: {
      storeId: result.store.id,
      accessPlan: input.accessPlan,
      billingAmount,
    },
  });

  return result;
}

export async function updateRetailAccount(input: {
  platformUser: User;
  userId: string;
  businessName?: string;
  firstName?: string | null;
  lastName?: string | null;
  accessPlan?: RetailAccessPlan;
  billingAmount?: number;
  password?: string;
}) {
  const user = await db.user.findUnique({
    where: { id: input.userId },
    select: {
      id: true,
      clerkId: true,
      organizationId: true,
      email: true,
      firstName: true,
      lastName: true,
    },
  });
  if (!user?.organizationId) throw new Error("Usuario no encontrado");

  const store = await db.retailStore.findUnique({
    where: { organizationId: user.organizationId },
    select: { id: true },
  });
  if (!store) throw new Error("La cuenta no tiene tienda INTIENDAS");

  let clerkId = user.clerkId;

  if (input.password) {
    const password = normalizePassword(input.password);
    try {
      const clerkUser = await ensureClerkUserForEmail({
        email: user.email,
        password,
        firstName: input.firstName ?? user.firstName ?? undefined,
        lastName: input.lastName ?? user.lastName ?? undefined,
        existingClerkId: user.clerkId,
      });
      clerkId = clerkUser.id;
      if (clerkUser.id !== user.clerkId) {
        await db.user.update({
          where: { id: user.id },
          data: { clerkId: clerkUser.id },
        });
        await syncClerkPublicMetadata(clerkUser.id, {
          role: "ADMIN",
          dbUserId: user.id,
        });
      }
    } catch (error) {
      throw retailAccountError(
        error,
        "No se pudo actualizar la contraseña. Usa una contraseña más segura (mín. 8 caracteres).",
      );
    }
  } else if (input.firstName !== undefined || input.lastName !== undefined) {
    if (isRealClerkUserId(clerkId)) {
      try {
        await clerk().users.updateUser(clerkId, {
          firstName: input.firstName?.trim() || undefined,
          lastName: input.lastName?.trim() || undefined,
        });
      } catch (error) {
        throw retailAccountError(error, "No se pudo actualizar el nombre en Clerk.");
      }
    }
  }

  const businessName = input.businessName?.trim();
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        ...(input.firstName !== undefined ? { firstName: input.firstName?.trim() || null } : {}),
        ...(input.lastName !== undefined ? { lastName: input.lastName?.trim() || null } : {}),
        ...(businessName ? { companyName: businessName } : {}),
      },
    });
    if (businessName) {
      await tx.organization.update({
        where: { id: user.organizationId! },
        data: { name: businessName },
      });
    }
    await tx.retailStore.update({
      where: { id: store.id },
      data: {
        ...(businessName ? { name: businessName } : {}),
        ...(input.accessPlan ? { accessPlan: input.accessPlan } : {}),
        ...(input.billingAmount !== undefined
          ? { billingAmount: normalizeAmount(input.billingAmount) }
          : {}),
      },
    });
  });

  await writeRetailAdminPlatformAudit({
    platformUser: input.platformUser,
    action: "retail_account_update",
    organizationId: user.organizationId,
    targetUserId: user.id,
    metadata: {
      accessPlan: input.accessPlan,
      billingAmount: input.billingAmount,
      passwordChanged: Boolean(input.password),
    },
  });
}

export async function setRetailAccountActive(input: {
  platformUser: User;
  userId: string;
  isActive: boolean;
}) {
  const user = await db.user.findUnique({
    where: { id: input.userId },
    select: { id: true, organizationId: true, isActive: true },
  });
  if (!user?.organizationId) throw new Error("Usuario no encontrado");

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { isActive: input.isActive, ...(input.isActive ? { deletedAt: null } : {}) },
    });
    await tx.retailStore.update({
      where: { organizationId: user.organizationId! },
      data: {
        status: input.isActive ? "ACTIVE" : "INACTIVE",
        ...(input.isActive ? { deletedAt: null } : {}),
      },
    });
  });

  await writeRetailAdminPlatformAudit({
    platformUser: input.platformUser,
    action: input.isActive ? "retail_account_activate" : "retail_account_suspend",
    organizationId: user.organizationId,
    targetUserId: user.id,
  });
}

export async function deleteRetailAccount(input: {
  platformUser: User;
  userId: string;
}) {
  const user = await db.user.findUnique({
    where: { id: input.userId },
    select: { id: true, organizationId: true },
  });
  if (!user?.organizationId) throw new Error("Usuario no encontrado");

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { isActive: false, deletedAt: new Date() },
    });
    await tx.retailStore.update({
      where: { organizationId: user.organizationId! },
      data: { status: "INACTIVE", deletedAt: new Date() },
    });
  });

  await writeRetailAdminPlatformAudit({
    platformUser: input.platformUser,
    action: "retail_account_delete",
    organizationId: user.organizationId,
    targetUserId: user.id,
  });
}

/** @deprecated kept for compatibility — prefer createRetailAccount */
export async function listRetailUsers(options: { organizationId?: string; q?: string } = {}) {
  return listRetailAccounts(options);
}
