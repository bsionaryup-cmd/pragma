import { Prisma } from "@prisma/client";

export const USER_SCHEMA_DRIFT_HINT =
  "Base de datos desactualizada. Ejecuta: npm run db:migrate:deploy (o npm run db:repair:user)";

export function isUserSchemaDriftError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2021" || error.code === "P2022") {
      const column = error.meta?.column;
      if (typeof column === "string" && column.includes("users.")) {
        return true;
      }
      const table = error.meta?.table;
      if (typeof table === "string" && table.includes("users")) {
        return true;
      }
    }
  }

  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("users.locale") ||
    message.includes("users.theme") ||
    message.includes("users.timezone") ||
    (message.includes("column") && message.includes("users"))
  );
}

export function toUserSchemaDriftError(error: unknown): Error {
  if (error instanceof Error && error.message === USER_SCHEMA_DRIFT_HINT) {
    return error;
  }
  return new Error(USER_SCHEMA_DRIFT_HINT, {
    cause: error instanceof Error ? error : undefined,
  });
}

export function rethrowUnlessUserSchemaDrift(error: unknown): never {
  if (isUserSchemaDriftError(error)) {
    throw toUserSchemaDriftError(error);
  }
  throw error;
}

/** Valores por defecto cuando el registro no trae prefs (usuarios legacy). */
export function withUserPreferenceDefaults<T extends {
  locale?: string | null;
  theme?: string | null;
  timezone?: string | null;
}>(user: T): T & {
  locale: string;
  theme: string;
  timezone: string;
} {
  return {
    ...user,
    locale: user.locale?.trim() || "es",
    theme: user.theme?.trim() || "system",
    timezone: user.timezone?.trim() || "America/Bogota",
  };
}
