/**
 * Completa evidencias Resend del flujo E2E (bienvenida / admin / código).
 * Uso: npx tsx scripts/fetch-full-flow-resend-evidence.ts
 */
import { config } from "dotenv";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

config();
config({ path: ".env.local", override: true });

async function fetchOne(id: string) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const response = await fetch(`https://api.resend.com/emails/${id}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const body = (await response.json()) as Record<string, unknown>;
  const html = typeof body.html === "string" ? body.html : "";
  return {
    httpStatus: response.status,
    id: body.id ?? id,
    from: body.from ?? null,
    to: body.to ?? null,
    subject: body.subject ?? null,
    created_at: body.created_at ?? null,
    last_event: body.last_event ?? null,
    htmlChecks: {
      pragmaBrand: /PRAGMA/i.test(html),
      guestRegistrationLink: /guest-registration\//i.test(html),
      code484300: html.includes("484300"),
      markdownBoldCode: /\*\*\d+#\*\*/.test(html),
    },
    html,
  };
}

async function main() {
  const evidencePath = join(
    process.cwd(),
    "docs",
    "audits",
    "evidence",
    "full-gr-direct-ttlock-flow-evidence.json",
  );
  const evidence = JSON.parse(readFileSync(evidencePath, "utf8")) as {
    welcome?: { first?: { providerId?: string } };
    adminNotify?: { log?: Array<{ providerIds?: Record<string, string> }> };
    reservationId?: string;
  };

  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { PrismaClient } = await import("@prisma/client");
  const pg = await import("pg");
  const pool = new pg.default.Pool({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });

  // Access-code emails are not persisted with providerId on credential;
  // recover recent Resend sends by listing is not available without search —
  // re-read credential + attempt notify to confirm skip; store code evidence from DB.
  const cred = evidence.reservationId
    ? await db.accessCredential.findFirst({
        where: { reservationId: evidence.reservationId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          deliveryStatus: true,
          status: true,
          codeEncrypted: true,
        },
      })
    : null;

  const welcomeId = evidence.welcome?.first?.providerId;
  const adminId = evidence.adminNotify?.log?.[0]?.providerIds
    ? Object.values(evidence.adminNotify.log[0].providerIds)[0]
    : undefined;

  const outDir = join(process.cwd(), "docs", "audits", "evidence");
  mkdirSync(outDir, { recursive: true });

  const results: Record<string, unknown> = {
    credential: cred,
    welcome: welcomeId ? await fetchOne(welcomeId) : null,
    admin: adminId ? await fetchOne(adminId) : null,
  };

  if (results.welcome && typeof (results.welcome as { html?: string }).html === "string") {
    writeFileSync(
      join(outDir, "full-flow-welcome-email.html"),
      (results.welcome as { html: string }).html,
      "utf8",
    );
    delete (results.welcome as { html?: string }).html;
  }
  if (results.admin && typeof (results.admin as { html?: string }).html === "string") {
    writeFileSync(
      join(outDir, "full-flow-admin-email.html"),
      (results.admin as { html: string }).html,
      "utf8",
    );
    delete (results.admin as { html?: string }).html;
  }

  // Search recent emails via Resend for access code subject if possible
  // (Resend list emails API)
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (apiKey) {
    const list = await fetch("https://api.resend.com/emails?limit=20", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const listBody = (await list.json()) as {
      data?: Array<{ id: string; to: string[]; subject: string; last_event?: string }>;
    };
    const codeMails = (listBody.data ?? []).filter((e) =>
      /código de acceso|codigo de acceso/i.test(e.subject),
    );
    results.recentAccessCodeEmails = codeMails.slice(0, 5);
    if (codeMails[0]) {
      const full = await fetchOne(codeMails[0].id);
      writeFileSync(
        join(outDir, "full-flow-access-code-email.html"),
        full.html,
        "utf8",
      );
      delete (full as { html?: string }).html;
      results.accessCodeSample = full;
    }
  }

  writeFileSync(
    join(outDir, "full-flow-resend-summaries.json"),
    JSON.stringify(results, null, 2),
    "utf8",
  );
  console.log(JSON.stringify(results, null, 2));
  await db.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
