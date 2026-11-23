/**
 * Dev server bound to staging env only (no .env.local operational override).
 * Default port 3005 to avoid colliding with other worktree on 3000.
 */
import { spawn, execSync } from "node:child_process";
import { resolve } from "node:path";
import "./load-staging-env.mjs";

execSync("node scripts/staging/assert-staging-db.mjs", {
  stdio: "inherit",
  env: process.env,
});

const port = process.env.PORT || "3005";
process.env.PORT = port;
process.env.NEXT_PUBLIC_APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${port}`;
process.env.APP_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;

console.log(`→ prisma generate`);
execSync("npx prisma generate", { stdio: "inherit", env: process.env });

console.log(`→ next dev on :${port} (WEB BUILDER staging)`);
const child = spawn(
  "npx",
  ["next", "dev", "--webpack", "-p", port],
  {
    stdio: "inherit",
    cwd: resolve(process.cwd()),
    env: process.env,
    shell: true,
  },
);

child.on("exit", (code) => process.exit(code ?? 0));
