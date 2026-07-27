const base = "https://www.pragmapms.com";

async function p(label, url, init = {}) {
  const r = await fetch(url, {
    redirect: "manual",
    headers: {
      "user-agent": "pragma-auth-audit",
      ...(init.headers || {}),
    },
  });
  const t = await r.text();
  const flow = (t.match(/data-pragma-auth-flow="([^"]+)/) || [])[1] || null;
  const dpl = (t.match(/data-dpl-id="([^"]+)/) || [])[1] || null;
  let body = null;
  try {
    body = JSON.parse(t);
  } catch {
    body = null;
  }
  console.log(
    JSON.stringify({
      label,
      status: r.status,
      loc: r.headers.get("location"),
      clerkStatus: r.headers.get("x-clerk-auth-status"),
      clerkReason: r.headers.get("x-clerk-auth-reason"),
      bypass: r.headers.get("x-pragma-clerk-handshake-bypass"),
      flow,
      dpl,
      body,
    }),
  );
}

await p("sign_in", `${base}/sign-in`);
await p("session_ready", `${base}/api/auth/session-ready`);
await p("panel", `${base}/panel`, {
  headers: { "sec-fetch-dest": "document" },
});
await p("panel_uat", `${base}/panel`, {
  headers: { "sec-fetch-dest": "document", cookie: "__client_uat=1" },
});
await p("continue", `${base}/auth/continue?next=%2Fpanel`);
await p("clerk_env", `${base}/__clerk/v1/environment`);
