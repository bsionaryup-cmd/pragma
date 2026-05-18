/**
 * Confirma que el Prisma Client generado acepta imageUrl en User.update.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const userModelPath = join(
  process.cwd(),
  "src",
  "generated",
  "prisma",
  "models",
  "User.ts",
);

const content = readFileSync(userModelPath, "utf8");

const required = [
  "imageUrl?:",
  "lastLoginAt?:",
  "firstName?:",
  "lastName?:",
];

const missing = required.filter((token) => !content.includes(token));

if (missing.length > 0) {
  console.error("✗ User model generado incompleto. Falta:", missing.join(", "));
  process.exit(1);
}

console.log("✓ Prisma User.update incluye imageUrl, firstName, lastName, lastLoginAt");
