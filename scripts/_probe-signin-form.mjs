const res = await fetch("https://www.pragmapms.com/sign-in");
const t = await res.text();
console.log(
  JSON.stringify({
    flow: (t.match(/data-pragma-auth-flow="([^"]+)/) || [])[1] || null,
    proxy: (t.match(/data-clerk-proxy-url="([^"]+)/) || [])[1] || null,
    dpl: (t.match(/data-dpl-id="([^"]+)/) || [])[1] || null,
    hasConfirm: /Confirmando sesi/.test(t),
    hasPassword: /password/i.test(t),
    hasEmail: /correo|email/i.test(t),
  }),
);
