const base = "https://www.pragmapms.com";

async function p(label, url, init = {}) {
  const r = await fetch(url, {
    redirect: "manual",
    headers: {
      "user-agent": "pragma-login-settle-v1",
      ...(init.headers || {}),
    },
  });
  const t = await r.text();
  console.log(
    JSON.stringify({
      label,
      status: r.status,
      loc: r.headers.get("location"),
      bypass: r.headers.get("x-pragma-clerk-handshake-bypass"),
      flow: (t.match(/data-pragma-auth-flow="([^"]+)/) || [])[1] || null,
      proxy: (t.match(/data-clerk-proxy-url="([^"]+)/) || [])[1] || null,
      dpl: (t.match(/data-dpl-id="([^"]+)/) || [])[1] || null,
      hasConfirmGate: /Confirmando sesi[oó]n segura/i.test(t),
      hasPassword: /password/i.test(t),
      body: label === "session_ready" ? JSON.parse(t) : undefined,
    }),
  );
}

await p("sign_in", `${base}/sign-in`);
await p("continue", `${base}/auth/continue?next=%2Fpanel`);
await p("panel_uat", `${base}/panel`, {
  headers: { "sec-fetch-dest": "document", cookie: "__client_uat=1" },
});
await p("session_ready", `${base}/api/auth/session-ready`);
