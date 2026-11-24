process.env.PLATFORM_IMPERSONATION_SECRET =
  process.env.PLATFORM_IMPERSONATION_SECRET || "test-secret";

async function main() {
  const { NextResponse } = await import("next/server");
  const {
    applyImpersonationCookie,
    clearImpersonationCookie,
    parseImpersonationCookieValue,
  } = await import("../src/lib/platform/impersonation-cookie");
  const { PLATFORM_IMPERSONATION_COOKIE } = await import(
    "../src/lib/platform/constants"
  );

  const res = NextResponse.json({ ok: true });
  applyImpersonationCookie(res, "sess_abc123");
  const set = res.cookies.get(PLATFORM_IMPERSONATION_COOKIE);
  const parsed = parseImpersonationCookieValue(set?.value);

  const clear = NextResponse.json({ ok: true });
  clearImpersonationCookie(clear);
  const cleared = clear.cookies.get(PLATFORM_IMPERSONATION_COOKIE);

  console.log(
    JSON.stringify(
      {
        cookieName: set?.name ?? null,
        parsedOk: parsed === "sess_abc123",
        clearValueEmpty: cleared?.value === "",
        setCookieHeaderPresent: Boolean(res.headers.get("set-cookie")),
      },
      null,
      2,
    ),
  );

  if (!set?.name || parsed !== "sess_abc123" || !res.headers.get("set-cookie")) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
