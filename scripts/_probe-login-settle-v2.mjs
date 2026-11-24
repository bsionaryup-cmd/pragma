const base = "https://www.pragmapms.com";

async function p(label, url, init = {}) {
  const r = await fetch(url, {
    redirect: "manual",
    headers: {
      "user-agent": "pragma-login-settle-v2",
      ...(init.headers || {}),
    },
    ...init,
    headers: {
      "user-agent": "pragma-login-settle-v2",
      ...(init.headers || {}),
    },
  });
  const t = await r.text();
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
      bypass: r.headers.get("x-pragma-clerk-handshake-bypass"),
      flow: (t.match(/data-pragma-auth-flow="([^"]+)/) || [])[1] || null,
      proxy: (t.match(/data-clerk-proxy-url="([^"]+)/) || [])[1] || null,
      dpl: (t.match(/data-dpl-id="([^"]+)/) || [])[1] || null,
      hasPassword: /password/i.test(t),
      body,
    }),
  );
}

await p("sign_in", `${base}/sign-in`);
await p("session_ready", `${base}/api/auth/session-ready`);
await p("establish_empty", `${base}/api/auth/establish-session`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({}),
});
await p("panel_uat", `${base}/panel`, {
  headers: { "sec-fetch-dest": "document", cookie: "__client_uat=1" },
});
await p("continue", `${base}/auth/continue?next=%2Fpanel`);
