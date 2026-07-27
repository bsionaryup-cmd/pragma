const base = "https://www.pragmapms.com";
const html = await (await fetch(`${base}/sign-in`)).text();
const pick = (re) => {
  const m = html.match(re);
  return m ? m[1] : null;
};
console.log(
  JSON.stringify(
    {
      dpl: pick(/data-dpl-id="([^"]+)"/),
      authFlow: pick(/data-pragma-auth-flow="([^"]+)"/),
      proxy: pick(/data-clerk-proxy-url="([^"]+)"/),
    },
    null,
    2,
  ),
);
const ready = await (await fetch(`${base}/api/auth/session-ready`)).json();
console.log("session-ready", ready);
const panel = await fetch(`${base}/panel`, {
  redirect: "manual",
  headers: { "sec-fetch-dest": "document", cookie: "__client_uat=1" },
});
console.log({
  status: panel.status,
  location: panel.headers.get("location"),
  bypass: panel.headers.get("x-pragma-clerk-handshake-bypass"),
  clerkStatus: panel.headers.get("x-clerk-auth-status"),
  clerkReason: panel.headers.get("x-clerk-auth-reason"),
});
