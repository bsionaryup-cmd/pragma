/**
 * Valida callback TTLock en producción.
 * Uso: node scripts/validate-ttlock-callback.mjs
 */
const CANONICAL =
  "https://pragmapms.com/api/integrations/ttlock/callback";

async function probe(method) {
  const init = { method, signal: AbortSignal.timeout(15_000) };
  if (method === "POST") {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify({ ping: true });
  }
  const res = await fetch(CANONICAL, init);
  const text = method === "HEAD" ? "" : await res.text();
  let body;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text.slice(0, 200) };
    }
  }
  return { method, status: res.status, body };
}

async function main() {
  for (const method of ["GET", "POST", "HEAD", "OPTIONS"]) {
    const { status, body } = await probe(method);
    if (status === 405 || status >= 500) {
      console.error(`FAIL ${method} HTTP ${status}`, body);
      process.exit(1);
    }
    if (method !== "HEAD" && method !== "OPTIONS" && !body?.ok) {
      console.error(`FAIL ${method} body`, body);
      process.exit(1);
    }
    console.log(`OK ${method}`, status, body ?? "(no body)");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
