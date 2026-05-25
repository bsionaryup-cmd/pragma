/**
 * Verificación pre-push (sin tocar prod).
 * node scripts/verify-release.mjs
 */

import { spawnSync } from "node:child_process";

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

console.log("\n=== PRAGMA verify:release ===\n");

run("node", ["scripts/verify-permissions.mjs"]);
run("npm", ["run", "typecheck"]);
run("npm", ["run", "test:billing"]);

console.log("\n✓ verify:release passed");
console.log("  Siguiente: npm run build");
console.log("  Docs: docs/RELEASE-PUSH.md");
console.log("  DB: npm run db:migrate:deploy (en el entorno destino)\n");
