/**
 * Forensic probe: incomplete `__client_uat` without `__session` on production.
 * Documents ERR_TOO_MANY_REDIRECTS loop BEFORE deploy of auth-surface-pass fix.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveIncompleteSessionBridge } from "../src/lib/auth/clerk-incomplete-session-bridge";

const base = "https://www.pragmapms.com";

async function hit(label: string, url: string, cookie?: string) {
  const r = await fetch(url, {
    redirect: "manual",
    headers: {
      "user-agent": "pragma-auth-forensic-redirect-loop-2026-07-27",
      "sec-fetch-dest": "document",
      ...(cookie ? { cookie } : {}),
    },
  });
  return {
    label,
    status: r.status,
    location: r.headers.get("location"),
    bypass: r.headers.get("x-pragma-clerk-handshake-bypass"),
    clerkStatus: r.headers.get("x-clerk-auth-status"),
    clerkReason: r.headers.get("x-clerk-auth-reason"),
  };
}

async function main() {
  const probes = [
    await hit("panel_clean", `${base}/panel`),
    await hit("panel_uat", `${base}/panel`, "__client_uat=1"),
    await hit(
      "sign_in_uat",
      `${base}/sign-in?redirect_url=%2Fpanel`,
      "__client_uat=1",
    ),
    await hit("sign_in_clean", `${base}/sign-in`),
  ];

  const signInUat = probes.find((p) => p.label === "sign_in_uat");
  const loopConfirmed =
    signInUat?.status === 307 &&
    Boolean(signInUat.location?.includes("/sign-in")) &&
    signInUat.bypass === "settle-bridge";

  const localFixDecision = resolveIncompleteSessionBridge(
    "/sign-in",
    "?redirect_url=%2Fpanel",
  );

  const evidence = {
    at: new Date().toISOString(),
    productionHost: base,
    rootCause:
      "settle-bridge redirects /sign-in?redirect_url=/panel → same URL when __client_uat present without __session → ERR_TOO_MANY_REDIRECTS",
    confidence: 0.98,
    productionLoopConfirmedBeforeDeploy: loopConfirmed,
    probes,
    localFixDecision,
    expectedAfterDeploy: {
      sign_in_uat: {
        status: 200,
        bypass: "auth-surface-pass",
        note: "pass-through + expire __client_uat; no self-redirect",
      },
      panel_uat: {
        status: 307,
        location: "/sign-in?redirect_url=%2Fpanel",
        bypass: "settle-bridge",
        note: "single hop + Set-Cookie expire UAT",
      },
    },
    ok: loopConfirmed && localFixDecision.action === "pass-through",
  };

  const out = join(
    dirname(fileURLToPath(import.meta.url)),
    "../docs/audits/evidence/auth-redirect-loop-forensic.json",
  );
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
