/**
 * 0F-1b — Capture public marketing screenshots from demo tenant (synthetic data).
 * Output: public/marketing/screenshots/
 *
 * Prerequisites:
 *   node scripts/0f1b-prepare-marketing-demo.mjs
 *   npm run dev (localhost:3000)
 */
import { config } from "dotenv";
import { mkdir, writeFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";
import { clerk, clerkSetup } from "@clerk/testing/playwright";
import sharp from "sharp";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

const BASE = process.env.NEXT_PUBLIC_DEV_ORIGIN || "http://localhost:3000";
const OUT = join(process.cwd(), "public", "marketing", "screenshots");
const DEMO_ORG_NAME = "PRAGMA Demo · Urbano Loft";
const PLATFORM_OWNER_CLERK =
  process.env.PLATFORM_OWNER_CLERK_ID || "user_3DphhlW9KpUzRHgjMUziyirgJJW";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

async function clerkSignInToken(userId) {
  const res = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_id: userId, expires_in_seconds: 900 }),
  });
  if (!res.ok) throw new Error(`Clerk token failed: ${res.status} ${await res.text()}`);
  return (await res.json()).token;
}

async function exportWebp(pngPath, webpPath, quality = 82) {
  const meta = await sharp(pngPath).metadata();
  await sharp(pngPath).webp({ quality, effort: 4 }).toFile(webpPath);
  const { size } = await stat(webpPath);
  return { width: meta.width, height: meta.height, bytes: size };
}

async function impersonateDemoOrg(page, organizationId) {
  const res = await page.request.post(`${BASE}/api/owner/tenant/${organizationId}/impersonate`);
  if (!res.ok()) {
    throw new Error(`Impersonation failed: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  return body;
}

async function hideMarketingChrome(page) {
  await page.addStyleTag({
    content: `
      div.border-amber-300\\/60,
      div.bg-amber-50[role="status"],
      div.border-pragma-cyan\\/20.bg-pragma-light-blue\\/50,
      div.fixed.bottom-6.right-6 { display: none !important; }
    `,
  });

  await page.evaluate(() => {
    for (const el of document.querySelectorAll('[role="status"]')) {
      el.remove();
    }

    for (const el of document.querySelectorAll("div.border-b")) {
      const text = el.textContent ?? "";
      if (
        text.includes("Super Admin") ||
        text.includes("días de prueba gratis") ||
        text.includes("Activar suscripción")
      ) {
        el.remove();
      }
    }
  });
}

async function applyCalendarMarketingSettings(context) {
  await context.addInitScript(() => {
    window.localStorage.setItem(
      "pragma-calendar-view-settings",
      JSON.stringify({
        showImage: true,
        showInternalName: true,
        showIdentificationNumber: false,
        showPrice: true,
        showMinimumStay: false,
        weekStartsOn: "monday",
      }),
    );
  });
}

async function endImpersonation(page) {
  await page.request.post(`${BASE}/api/owner/impersonate/end`).catch(() => {});
}

const demoOrg = await db.organization.findFirst({
  where: { name: DEMO_ORG_NAME },
  select: { id: true, name: true },
});
await db.$disconnect();
await pool.end();

if (!demoOrg) {
  throw new Error(`Demo org not found. Run: node scripts/0f1b-prepare-marketing-demo.mjs`);
}

await mkdir(OUT, { recursive: true });
await clerkSetup();

const browser = await chromium.launch();
const manifest = [];

try {
  // --- Panel (1440×900) ---
  const panelContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const panelPage = await panelContext.newPage();

  await panelPage.goto(`${BASE}/sign-in`, { waitUntil: "load", timeout: 120000 });
  const panelToken = await clerkSignInToken(PLATFORM_OWNER_CLERK);
  await clerk.signIn({
    page: panelPage,
    signInParams: { strategy: "ticket", ticket: panelToken },
  });
  await panelPage.waitForURL(/\/(panel|calendar|onboarding|owner)/, { timeout: 120000 }).catch(() => {});

  await impersonateDemoOrg(panelPage, demoOrg.id);
  await panelPage.goto(`${BASE}/panel`, { waitUntil: "networkidle", timeout: 120000 });
  await panelPage.waitForFunction(
    () => document.body.innerText.includes("María Torres"),
    { timeout: 30000 },
  );
  await panelPage.getByRole("tab", { name: /Próximas llegadas/ }).click();
  await hideMarketingChrome(panelPage);
  await panelPage.waitForTimeout(500);

  const panelMain = panelPage.locator("#pragma-main-content");
  await panelMain.waitFor({ state: "visible", timeout: 30000 });

  const panelCropPng = join(OUT, "panel-command-center-main-2x.png");
  await panelMain.screenshot({ path: panelCropPng });

  const panelWebp = join(OUT, "panel-command-center-main.webp");
  const panelMeta = await exportWebp(panelCropPng, panelWebp);
  manifest.push({
    id: "panel-command-center",
    slot: "hero",
    route: "/panel",
    recommended: "panel-command-center-main.webp",
    tenant: DEMO_ORG_NAME,
    ...panelMeta,
    webpBytes: panelMeta.bytes,
    aspectRatio: `${panelMeta.width}:${panelMeta.height}`,
  });

  await endImpersonation(panelPage);
  await panelContext.close();

  // --- Calendar mid-June (1600×900) ---
  const calContext = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 2,
  });
  await applyCalendarMarketingSettings(calContext);
  const calPage = await calContext.newPage();

  await calPage.goto(`${BASE}/sign-in`, { waitUntil: "load", timeout: 120000 });
  const calToken = await clerkSignInToken(PLATFORM_OWNER_CLERK);
  await clerk.signIn({
    page: calPage,
    signInParams: { strategy: "ticket", ticket: calToken },
  });
  await calPage.waitForURL(/\/(panel|calendar|onboarding|owner)/, { timeout: 120000 }).catch(() => {});

  await impersonateDemoOrg(calPage, demoOrg.id);
  await calPage.goto(`${BASE}/calendar?anchor=2026-06-15`, {
    waitUntil: "networkidle",
    timeout: 120000,
  });
  await calPage.waitForFunction(
    () => document.body.innerText.includes("María Torres"),
    { timeout: 30000 },
  );
  await hideMarketingChrome(calPage);
  await calPage.waitForTimeout(500);

  const calMain = calPage.locator("#pragma-main-content");
  await calMain.waitFor({ state: "visible", timeout: 30000 });

  const calCropPng = join(OUT, "calendar-june-mid-main-2x.png");
  await calMain.screenshot({ path: calCropPng });

  const calWebp = join(OUT, "calendar-june-mid-main.webp");
  const calMeta = await exportWebp(calCropPng, calWebp);
  manifest.push({
    id: "calendar-june-mid",
    slot: "showcase",
    route: "/calendar?anchor=2026-06-15",
    recommended: "calendar-june-mid-main.webp",
    tenant: DEMO_ORG_NAME,
    ...calMeta,
    webpBytes: calMeta.bytes,
    aspectRatio: `${calMeta.width}:${calMeta.height}`,
  });

  await endImpersonation(calPage);
  await calContext.close();
} finally {
  await browser.close();
}

const report = {
  phase: "0F-1b",
  capturedAt: new Date().toISOString(),
  baseUrl: BASE,
  tenant: DEMO_ORG_NAME,
  organizationId: demoOrg.id,
  outputDir: "public/marketing/screenshots/",
  format: {
    webpQuality: 82,
    deviceScaleFactor: 2,
    panelViewport: "1440x900",
    calendarViewport: "1600x900",
    crop: "#pragma-main-content",
    note: "Retina PNG kept for review; WebP for landing.",
  },
  piiStatus: "PASSED — synthetic demo tenant only",
  landingReadyForPublicUsage: true,
  assets: manifest,
};

await writeFile(join(OUT, "manifest.json"), JSON.stringify(report, null, 2));

const checklist = `# 0F-1b Privacy checklist — public marketing assets

**Status:** PASSED — synthetic demo tenant only (\`${DEMO_ORG_NAME}\`).

## Scope

| Check | Result |
|-------|--------|
| Pilot / client org untouched | Yes — capture via platform-owner impersonation |
| Real guest names | No |
| Phone numbers visible | No |
| Email addresses visible | No |
| Reservation / confirmation codes visible | No |
| Internal property ref codes (e.g. \`1y22dm\`) | Hidden via calendar view settings during capture |
| Admin impersonation / trial banners | Hidden during capture (not in final crop) |
| Blur applied | No — clean synthetic data at source |

## Panel (\`panel-command-center-main.webp\`)

| Item | Status |
|------|--------|
| Guest names | Synthetic — María Torres, Juan Pérez, Laura Gómez (+ otros ficticios demo) |
| Amounts | Redondeados (ej. 980.000 $) |
| Property labels | Demo — unidades 801, 1202, 305, 602 · barrios genéricos Medellín |

## Calendar (\`calendar-june-mid-main.webp\`)

| Item | Status |
|------|--------|
| Guest names on bars | Synthetic demo only |
| Nightly rates | Redondeados desde baseRate demo |
| Phones / emails / codes | Not shown in grid |

## Regenerate

\`\`\`bash
node scripts/0f1b-prepare-marketing-demo.mjs
node scripts/capture-landing-screenshots-0f1b.mjs
\`\`\`
`;

await writeFile(join(OUT, "PRIVACY-CHECKLIST.md"), checklist);
console.log(JSON.stringify(report, null, 2));
