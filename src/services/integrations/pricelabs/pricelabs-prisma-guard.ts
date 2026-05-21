const SCHEMA_HINT =
  "Ejecuta: npm run db:migrate (desarrollo) o npm run db:migrate:deploy (producción).";

export function isPriceLabsSchemaDriftError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string }).code;
  return code === "P2021" || code === "P2022";
}

export function wrapPriceLabsSchemaError(error: unknown): Error {
  if (isPriceLabsSchemaDriftError(error)) {
    return new Error(
      `Esquema PriceLabs no aplicado en la base de datos. ${SCHEMA_HINT}`,
    );
  }
  return error instanceof Error ? error : new Error(String(error));
}

export function getPriceLabsSchemaSetupHint(): string {
  return SCHEMA_HINT;
}
