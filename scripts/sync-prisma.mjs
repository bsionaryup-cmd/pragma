/**
 * Regenera Prisma Client y limpia caché de Next.
 * Uso: npm run db:sync
 */
import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const nextDir = join(root, ".next");
const legacyGenerated = join(root, "src", "generated", "prisma");

if (existsSync(nextDir)) {
  rmSync(nextDir, { recursive: true, force: true });
  console.log(`✓ Eliminado: ${nextDir}`);
}

if (existsSync(legacyGenerated)) {
  rmSync(legacyGenerated, { recursive: true, force: true });
  console.log(`✓ Eliminado legacy: ${legacyGenerated}`);
}

execSync("npx prisma validate", { stdio: "inherit", cwd: root });
execSync("npx prisma generate", { stdio: "inherit", cwd: root });
console.log("✓ Prisma Client regenerado en node_modules. Reinicia `npm run dev`.");
