import { Prisma } from "@prisma/client";

export const TTLOCK_SCHEMA_DRIFT_HINT =
  "La base de datos no está sincronizada con TTLock. Ejecuta: npx prisma migrate deploy";

export function isTTLockSchemaDriftError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2021" || error.code === "P2022") return true;
    const column = error.meta?.column;
    if (typeof column === "string" && column.includes("ttlock")) return true;
  }

  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("ttlock_integrations") &&
    (message.includes("does not exist") ||
      message.includes("column") ||
      message.includes("Environment"))
  );
}

export function toTTLockSchemaDriftError(error: unknown): Error {
  if (error instanceof Error && error.message === TTLOCK_SCHEMA_DRIFT_HINT) {
    return error;
  }
  return new Error(TTLOCK_SCHEMA_DRIFT_HINT, {
    cause: error instanceof Error ? error : undefined,
  });
}

export function rethrowUnlessTTLockSchemaDrift(error: unknown): never {
  if (isTTLockSchemaDriftError(error)) {
    throw toTTLockSchemaDriftError(error);
  }
  throw error;
}
