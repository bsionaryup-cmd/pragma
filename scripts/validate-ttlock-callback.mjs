/**
 * Valida callback TTLock en producción.
 * Uso: node scripts/validate-ttlock-callback.mjs
 */
const CANONICAL =
  "https://pragma-pms.vercel.app/api/integrations/ttlock/callback";

async function main() {
  const res = await fetch(CANONICAL, { signal: AbortSignal.timeout(15_000) });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 200) };
  }

  if (!res.ok) {
    console.error(`FAIL HTTP ${res.status}`, body);
    process.exit(1);
  }

  if (!body?.ok) {
    console.error("FAIL body", body);
    process.exit(1);
  }

  console.log("OK", body);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
