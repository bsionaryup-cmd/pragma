import { execSync } from "node:child_process";
import { resolve } from "node:path";
import "./load-staging-env.mjs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// Re-run assert after env load
execSync("node scripts/staging/assert-staging-db.mjs", {
  stdio: "inherit",
  cwd: resolve(process.cwd()),
  env: process.env,
});

console.log("→ prisma migrate deploy (staging only)");
execSync("npx prisma migrate deploy", {
  stdio: "inherit",
  cwd: resolve(process.cwd()),
  env: process.env,
});
