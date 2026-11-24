import { createClerkClient } from "@clerk/backend";
import { readFileSync, unlinkSync } from "node:fs";

function loadEnv(path) {
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i < 0) continue;
    const key = trimmed.slice(0, i);
    let val = trimmed.slice(i + 1);
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const env = loadEnv(".env.production.pull");
const secretKey = env.CLERK_SECRET_KEY?.trim();
const pk = env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() || "";

if (!secretKey?.startsWith("sk_")) {
  console.error("No production CLERK_SECRET_KEY");
  process.exit(1);
}

console.log(
  JSON.stringify({
    pkPrefix: pk.slice(0, 7),
    skPrefix: secretKey.slice(0, 7),
    proxyUrl: env.NEXT_PUBLIC_CLERK_PROXY_URL || null,
  }),
);

const clerk = createClerkClient({ secretKey });

let offset = 0;
const limit = 100;
let users = 0;
let sessionsSeen = 0;
let revoked = 0;
const errors = [];

for (;;) {
  const page = await clerk.users.getUserList({ limit, offset });
  const data = page.data ?? page;
  if (!Array.isArray(data) || data.length === 0) break;

  for (const user of data) {
    users += 1;
    try {
      const sessPage = await clerk.sessions.getSessionList({
        userId: user.id,
        status: "active",
        limit: 100,
      });
      const sessions = sessPage.data ?? sessPage;
      if (!Array.isArray(sessions)) continue;
      for (const session of sessions) {
        sessionsSeen += 1;
        try {
          await clerk.sessions.revokeSession(session.id);
          revoked += 1;
        } catch (e) {
          errors.push({
            sessionId: session.id,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
    } catch (e) {
      errors.push({
        userId: user.id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  if (data.length < limit) break;
  offset += limit;
  if (offset > 5000) break;
}

console.log(
  JSON.stringify({ users, sessionsSeen, revoked, errorCount: errors.length, errors: errors.slice(0, 5) }),
);

try {
  unlinkSync(".env.production.pull");
} catch {
  /* ignore */
}
