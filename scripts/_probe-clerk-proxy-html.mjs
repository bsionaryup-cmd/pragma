const res = await fetch("https://www.pragmapms.com/sign-in");
const t = await res.text();
const proxy = t.match(/data-clerk-proxy-url="([^"]*)"/)?.[1] ?? null;
const flow = t.match(/data-pragma-auth-flow="([^"]*)"/)?.[1] ?? null;
const dpl = t.match(/data-dpl-id="([^"]*)"/)?.[1] ?? null;
const abs = (t.match(/https:\/\/www\.pragmapms\.com\/__clerk/g) || []).length;
const rel = (t.match(/"\/__clerk"/g) || []).length;
console.log(JSON.stringify({ proxy, flow, dpl, abs, rel, status: res.status }));
