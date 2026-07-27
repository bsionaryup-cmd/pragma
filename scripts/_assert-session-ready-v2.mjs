/**
 * Static assert: login-settle-v2 (establish-session cookie bridge).
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

async function read(rel) {
  return readFile(path.join(root, rel), "utf8");
}

const navigation = await read("src/lib/auth/post-auth-navigation.ts");
assert.match(navigation, /establish-session/);
assert.match(navigation, /session-ready/);
assert.doesNotMatch(navigation, /buildAuthContinuePath\(target\)/);

const establish = await read("src/app/api/auth/establish-session/route.ts");
assert.match(establish, /__session/);
assert.match(establish, /verifyToken/);
assert.match(establish, /getCookieSuffix/);
assert.match(establish, /getSuffixedCookieName/);

const layout = await read("src/components/auth/pragma-auth-layout.tsx");
assert.match(layout, /data-pragma-auth-flow=\"login-settle-v2a\"/);

const signIn = await read("src/app/(auth)/sign-in/[[...sign-in]]/page.tsx");
assert.match(signIn, /serverSessionActive/);
assert.doesNotMatch(signIn, /PostAuthSessionGate/);

console.log("login-settle-v2 SSOT assert OK");
