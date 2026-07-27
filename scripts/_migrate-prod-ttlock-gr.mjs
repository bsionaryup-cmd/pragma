import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";

const raw = readFileSync(".env.production.pull", "utf8");
const m = raw.match(/^DATABASE_URL=(.*)$/m);
if (!m) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}
let v = m[1].trim();
if (
  (v.startsWith('"') && v.endsWith('"')) ||
  (v.startsWith("'") && v.endsWith("'"))
) {
  v = v.slice(1, -1);
}
if (!v || v.length < 10) {
  console.error("DATABASE_URL empty (encrypted pull?)");
  process.exit(1);
}

writeFileSync(".env.migrate.tmp", `DATABASE_URL=${JSON.stringify(v)}\n`);
const r = spawnSync(
  "npx",
  ["prisma", "migrate", "deploy", "--schema", "prisma/schema.prisma"],
  {
    env: { ...process.env, DATABASE_URL: v },
    encoding: "utf8",
    shell: true,
  },
);
console.log(r.stdout || "");
console.error(r.stderr || "");
try {
  unlinkSync(".env.migrate.tmp");
  unlinkSync(".env.production.pull");
} catch {
  /* ignore */
}
process.exit(r.status ?? 1);
