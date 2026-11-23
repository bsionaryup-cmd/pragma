/**
 * Moves Neon claim vars out of .env into .env.staging and restores .env.
 * Never logs secrets.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "dotenv";

const root = process.cwd();
const envPath = resolve(root, ".env");
const stagingPath = resolve(root, ".env.staging");
const localPath = resolve(root, ".env.local");

const OPERATIONAL = "ep-purple-block-apuk7v1k";

function parseFile(path) {
  if (!existsSync(path)) return {};
  return parse(readFileSync(path, "utf8"));
}

const envMap = parseFile(envPath);
const dbUrl = envMap.DATABASE_URL;
if (!dbUrl) {
  console.error("No DATABASE_URL in .env to promote");
  process.exit(1);
}
const host = new URL(dbUrl).host;
if (host.includes(OPERATIONAL)) {
  console.error("REFUSED: .env still points at operational host");
  process.exit(2);
}

const lines = [
  "# WEB BUILDER staging (neon claim / isolated). Gitignored. Do not commit.",
  "PRAGMA_WEB_BUILDER_STAGING=1",
  "PORT=3005",
  "NEXT_PUBLIC_APP_URL=http://localhost:3005",
  "APP_URL=http://localhost:3005",
  `DATABASE_URL=${JSON.stringify(dbUrl)}`,
];
if (envMap.DATABASE_URL_UNPOOLED) {
  lines.push(`DATABASE_URL_UNPOOLED=${JSON.stringify(envMap.DATABASE_URL_UNPOOLED)}`);
}
if (envMap.NEON_BRANCH) lines.push(`NEON_BRANCH=${envMap.NEON_BRANCH}`);
if (envMap.NEON_BRANCH_ID) lines.push(`NEON_BRANCH_ID=${envMap.NEON_BRANCH_ID}`);

const local = parseFile(localPath);
for (const key of [
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "NEXT_PUBLIC_CLERK_KEYLESS_DISABLED",
  "NEXT_PUBLIC_CLERK_SIGN_IN_URL",
  "NEXT_PUBLIC_CLERK_SIGN_UP_URL",
  "NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL",
  "NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL",
  "CLERK_WEBHOOK_SECRET",
]) {
  if (local[key]) lines.push(`${key}=${JSON.stringify(local[key])}`);
}

writeFileSync(stagingPath, `${lines.join("\n")}\n`);

writeFileSync(
  envPath,
  [
    "# Las variables activas estan en .env.local (Neon + Clerk).",
    "# Prisma y Next.js cargan .env.local con prioridad.",
    "# RESEND_API_KEY se define solo en .env.local",
    "# Staging WEB BUILDER vive exclusivamente en .env.staging",
    'EMAIL_FROM="PRAGMA PMS <noreply@pragmapms.com>"',
    "PRAGMA_BILLING_EMAIL=facturacion@pragmapms.com",
    "",
  ].join("\n"),
);

console.log(
  JSON.stringify(
    {
      ok: true,
      stagingHost: host,
      stagingFile: ".env.staging",
      envRestored: true,
      clerkKeysCopied: [
        "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
        "CLERK_SECRET_KEY",
      ].every((k) => Boolean(local[k])),
    },
    null,
    2,
  ),
);
