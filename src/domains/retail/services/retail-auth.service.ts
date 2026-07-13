import "server-only";

import { createClerkClient } from "@clerk/backend";
import { db } from "@/lib/db";
import { findStoreForOrg } from "../services/store.service";

function clerk() {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) throw new Error("CLERK_SECRET_KEY no configurado");
  return createClerkClient({ secretKey });
}

/**
 * Login INTIENDAS sin código de verificación de dispositivo.
 * Valida contraseña en Backend API y emite sign-in token (ticket).
 * Solo para cuentas con tienda retail activa.
 */
export async function issueRetailSignInTicket(input: {
  email: string;
  password: string;
}): Promise<{ ticket: string }> {
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  if (!email.includes("@") || password.length < 8) {
    throw new Error("Correo o contraseña incorrectos.");
  }

  const dbUser = await db.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: {
      id: true,
      clerkId: true,
      isActive: true,
      deletedAt: true,
      organizationId: true,
    },
  });

  if (!dbUser || !dbUser.isActive || dbUser.deletedAt || !dbUser.organizationId) {
    throw new Error("Correo o contraseña incorrectos.");
  }

  const store = await findStoreForOrg(dbUser.organizationId);
  if (!store || store.status === "INACTIVE" || store.deletedAt) {
    throw new Error(
      "Esta cuenta no tiene acceso activo a INTIENDAS. Contacta al administrador.",
    );
  }

  if (!dbUser.clerkId.startsWith("user_")) {
    throw new Error(
      "Esta cuenta no tiene acceso Clerk válido. Recréala desde el panel Owner.",
    );
  }

  const client = clerk();

  try {
    const verified = await client.users.verifyPassword({
      userId: dbUser.clerkId,
      password,
    });
    if (!verified?.verified) {
      throw new Error("Correo o contraseña incorrectos.");
    }
  } catch (error) {
    const code =
      error && typeof error === "object" && "errors" in error
        ? (error as { errors?: Array<{ code?: string }> }).errors?.[0]?.code
        : undefined;
    if (code === "form_password_incorrect" || code === "incorrect_password") {
      throw new Error("Correo o contraseña incorrectos.");
    }
    if (error instanceof Error && /incorrect|password/i.test(error.message)) {
      throw new Error("Correo o contraseña incorrectos.");
    }
    throw new Error("Correo o contraseña incorrectos.");
  }

  const token = await client.signInTokens.createSignInToken({
    userId: dbUser.clerkId,
    expiresInSeconds: 60,
  });

  if (!token.token) {
    throw new Error("No se pudo iniciar sesión. Intenta de nuevo.");
  }

  return { ticket: token.token };
}
