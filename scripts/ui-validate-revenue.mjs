/**
 * Validación operativa VISUAL del módulo /revenue vía Playwright + UI real.
 * Genera capturas en scripts/ui-validation-screenshots/
 */
import { config } from "dotenv";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createDecipheriv, createHash } from "node:crypto";
import { chromium } from "playwright";
import { clerk } from "@clerk/testing/playwright";
import { clerkSetup } from "@clerk/testing/playwright";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

const BASE_URL = process.env.NEXT_PUBLIC_DEV_ORIGIN || "http://localhost:3000";
const PILOT_EMAIL = "urbanovaloft@gmail.com";
const PROPERTY_ID = "cmpm0xani000004jgxfqjnih0";
const LISTING_ID = "1659835181966511536";
const UNIT_MARKER = "803";
const SCREENSHOT_DIR = join(process.cwd(), "scripts", "ui-validation-screenshots");
const API_BASE = (process.env.PRICELABS_BASE_URL || "https://api.pricelabs.co").replace(/\/$/, "");
const SECRET_PREFIX = "enc:v1:";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

function getEncryptionKey() {
  const source =
    process.env.TTLOCK_ENCRYPTION_KEY ||
    process.env.CLERK_SECRET_KEY ||
    process.env.DATABASE_URL;
  return createHash("sha256").update(source).digest();
}

function decryptSecret(value) {
  if (!value?.startsWith(SECRET_PREFIX)) return value?.trim() || null;
  const raw = Buffer.from(value.slice(SECRET_PREFIX.length), "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8").trim();
}

async function clerkSignInToken() {
  const res = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_id: "user_3EEwb6mJgmcvy25NoBQ4vvdpLo6", expires_in_seconds: 900 }),
  });
  if (!res.ok) throw new Error(`Clerk token failed: ${res.status}`);
  const data = await res.json();
  return data.token;
}

function resolveCanonicalBounds(meta, propertyBase) {
  const listing = meta?.listing ?? {};
  const bounds = meta?.bounds;
  const canonical = Boolean(bounds?.updatedAt);
  const baseNum =
    propertyBase != null ? Number.parseFloat(String(propertyBase)) : null;
  if (!canonical && !listing.id) {
    return { min: null, base: baseNum, max: null };
  }
  const min = canonical ? (bounds?.min ?? listing.min) : listing.min;
  const base = canonical
    ? (bounds?.base ?? listing.base ?? baseNum)
    : (listing.base ?? baseNum);
  const max = canonical
    ? bounds?.max === null
      ? null
      : (bounds?.max ?? listing.max)
    : listing.max;
  return { min: min ?? null, base: base ?? null, max: max ?? null };
}

async function readBackendSnapshot() {
  const property = await db.property.findUnique({
    where: { id: PROPERTY_ID },
    include: { priceLabs: true },
  });
  const meta =
    property?.priceLabs?.meta && typeof property.priceLabs.meta === "object"
      ? property.priceLabs.meta
      : {};
  const integration = await db.organizationIntegration.findFirst({
    where: { organizationId: "cmplxfg0a000105jrs0gqtwyc", provider: "PRICELABS" },
    select: { lastPricesSyncAt: true },
  });
  return {
    propertyBase: property?.baseRate?.toString() ?? null,
    canonical: resolveCanonicalBounds(meta, property?.baseRate?.toString()),
    bounds: meta.bounds ?? null,
    listingMax: meta.listing?.max ?? null,
    priceDelta: property?.priceLabs?.priceDelta?.toString() ?? null,
    recommendedRate: property?.priceLabs?.recommendedRate?.toString() ?? null,
    orgLastPricesSyncAt: integration?.lastPricesSyncAt?.toISOString() ?? null,
    metaLastPricesSync: meta.lastPricesSync ?? null,
    metaLastBoundsUpdate: meta.lastBoundsUpdate ?? null,
  };
}

async function resolveApiKey() {
  const row = await db.organizationIntegration.findFirst({
    where: { organizationId: "cmplxfg0a000105jrs0gqtwyc", provider: "PRICELABS" },
    select: { apiKeyEncrypted: true },
  });
  return decryptSecret(row?.apiKeyEncrypted) || process.env.PRICELABS_API_KEY?.trim() || null;
}

async function pl(apiKey, path, { method = "GET", body } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const raw = await response.text();
  let payload = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    payload = { message: raw.slice(0, 200) };
  }
  return { status: response.status, payload };
}

async function readKpis(page) {
  return page.evaluate(() => {
    const readKpi = (label) => {
      const el = [...document.querySelectorAll("p")].find(
        (p) => p.textContent?.trim() === label,
      );
      if (!el) return null;
      const box = el.parentElement;
      const ps = box ? [...box.querySelectorAll("p")] : [];
      return ps[1]?.textContent?.trim() ?? null;
    };
    const headerSync = [...document.querySelectorAll("span")].find((span) =>
      span.textContent?.includes("Última sincronización"),
    );
    const headerSyncValue =
      headerSync?.querySelector("span.font-semibold")?.textContent?.trim() ?? null;
    const reviewChip = [...document.querySelectorAll("span")].find((span) =>
      /por revisar$/.test(span.textContent?.trim() ?? ""),
    );
    return {
      saludPricing: readKpi("Estado de tarifas"),
      alertasDelta: readKpi("Alertas de tarifa"),
      headerUltimaSync: headerSyncValue,
      reviewCount: reviewChip?.textContent?.trim() ?? null,
    };
  });
}

async function ensurePropertyRowVisible(page) {
  const row = page.locator("tr", { hasText: UNIT_MARKER });
  if ((await row.count()) > 0) return;

  const toggle = page.getByRole("switch", { name: "Solo anomalías" });
  if ((await toggle.count()) > 0) {
    const checked = await toggle.getAttribute("aria-checked");
    if (checked === "true") await toggle.click();
  }

  const search = page.getByLabel("Buscar propiedad");
  if ((await search.count()) > 0) {
    await search.fill(UNIT_MARKER);
  }

  await page.locator("tr", { hasText: UNIT_MARKER }).first().waitFor({ timeout: 60000 });
}

async function readPropertyRow(page) {
  return page.evaluate((marker) => {
    const row = [...document.querySelectorAll("tr")].find(
      (tr) => tr.textContent?.includes(marker) && tr.querySelector("input"),
    );
    if (!row) return null;
    const inputs = [...row.querySelectorAll("input")];
    return {
      min: inputs[0]?.value ?? "",
      base: inputs[1]?.value ?? "",
      max: inputs[2]?.value ?? "",
    };
  }, UNIT_MARKER);
}

async function propertyRowLocator(page) {
  return page.locator("tr", { hasText: UNIT_MARKER }).first();
}

async function savePropertyRow(page) {
  await ensurePropertyRowVisible(page);
  const row = await propertyRowLocator(page);
  const saveBtn = row.getByRole("button", { name: /guardar/i });
  await saveBtn.click();
  const spinner = saveBtn.locator("svg.animate-spin");
  const started = await spinner
    .waitFor({ state: "visible", timeout: 10000 })
    .then(() => true)
    .catch(() => false);
  if (started) {
    await spinner.waitFor({ state: "detached", timeout: 120000 });
  }
  await page.waitForTimeout(4000);
}

async function gotoRevenue(page) {
  await page.goto(`${BASE_URL}/revenue`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page.waitForSelector("text=Estado de tarifas", { timeout: 60000 });
  await ensurePropertyRowVisible(page);
}

async function snap(page, name, report) {
  const file = join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  const ui = {
    kpis: await readKpis(page),
    property: await readPropertyRow(page),
    backend: await readBackendSnapshot(),
  };
  report.screenshots.push({ name, file, ui });
  return ui;
}

async function setRowInputs(page, { min, base, max }) {
  await ensurePropertyRowVisible(page);
  const row = await propertyRowLocator(page);
  const inputs = row.locator("input");
  if (min !== undefined) await inputs.nth(0).fill(String(min));
  if (base !== undefined) await inputs.nth(1).fill(String(base));
  if (max !== undefined) await inputs.nth(2).fill(max === "" ? "" : String(max));
}

async function main() {
  await mkdir(SCREENSHOT_DIR, { recursive: true });
  await clerkSetup();
  const token = await clerkSignInToken();
  const report = {
    startedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    property: `APTO ${UNIT_MARKER}`,
    phases: [],
    screenshots: [],
    verdict: null,
  };

  const apiKey = await resolveApiKey();
  const listingsBefore = apiKey ? await pl(apiKey, "/v1/listings") : null;
  const remoteBefore = listingsBefore?.payload?.listings?.find(
    (l) => String(l.id) === LISTING_ID,
  );

  const original = {
    min: remoteBefore?.min ?? null,
    base: remoteBefore?.base ?? null,
    max: remoteBefore?.max ?? null,
  };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
  const page = await context.newPage();

  try {
    await page.goto(`${BASE_URL}/sign-in`, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
    await clerk.loaded({ page });
    await clerk.signIn({
      page,
      signInParams: { strategy: "ticket", ticket: token },
    });
    await gotoRevenue(page);
    const baseline = await snap(page, "00-baseline", report);
    report.phases.push({
      name: "Baseline",
      ui: baseline,
      backend: baseline.backend,
    });

    // FASE A — Eliminar máximo
    const phaseA = { name: "A — Eliminar Precio Máximo", steps: [], pass: false };
    report.phases.push(phaseA);

    await setRowInputs(page, { max: "" });
    await savePropertyRow(page);
    const afterSaveMax = await snap(page, "A1-after-save-max-cleared", report);
    phaseA.steps.push({ step: "Guardar con máximo vacío", ui: afterSaveMax });

    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector("text=Estado de tarifas");
    await ensurePropertyRowVisible(page);
    const afterRefresh = await snap(page, "A2-after-refresh", report);
    phaseA.steps.push({ step: "F5 / reload", ui: afterRefresh });

    await page.goto(`${BASE_URL}/calendar`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await gotoRevenue(page);
    const afterNavigate = await snap(page, "A3-after-navigate-away-back", report);
    phaseA.steps.push({ step: "Salir y volver a /revenue", ui: afterNavigate });

    phaseA.pass =
      afterNavigate.property?.max === "" &&
      afterNavigate.backend.canonical.max === null &&
      afterRefresh.property?.max === "" &&
      afterRefresh.backend.canonical.max === null;

    // FASE B — Modificar mínimo
    const phaseB = { name: "B — Modificar Precio Mínimo", steps: [], pass: false };
    report.phases.push(phaseB);

    const kpiBeforeMin = await readKpis(page);
    const beforeMinUi = await snap(page, "B0-before-min", report);
    const minBefore = Number.parseInt(beforeMinUi.property?.min || "0", 10);
    const testMin = minBefore - 2000;
    await setRowInputs(page, { min: testMin });
    await savePropertyRow(page);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector("text=Estado de tarifas");
    await ensurePropertyRowVisible(page);
    const afterMin = await snap(page, "B1-after-min-change", report);
    const kpiAfterMin = afterMin.kpis;

    phaseB.steps.push({
      step: "Cambiar mínimo y guardar",
      before: { min: minBefore, kpis: kpiBeforeMin },
      after: { min: testMin, ui: afterMin, kpis: kpiAfterMin },
      saludChanged:
        kpiBeforeMin.saludPricing !== kpiAfterMin.saludPricing ||
        kpiBeforeMin.headerUltimaSync !== kpiAfterMin.headerUltimaSync,
    });

    phaseB.pass =
      afterMin.backend.canonical.min === testMin &&
      afterMin.property?.min === String(testMin) &&
      (kpiAfterMin.headerUltimaSync !== kpiBeforeMin.headerUltimaSync ||
        afterMin.backend.metaLastBoundsUpdate !== beforeMinUi.backend.metaLastBoundsUpdate);

    // FASE C — Modificar base
    const phaseC = { name: "C — Modificar Precio Base", steps: [], pass: false };
    report.phases.push(phaseC);

    const beforeBaseUi = afterMin;
    const baseBefore = Number.parseInt(afterMin.property?.base || "0", 10);
    const testBase = baseBefore + 1500;
    await setRowInputs(page, { base: testBase });
    await savePropertyRow(page);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector("text=Estado de tarifas");
    await ensurePropertyRowVisible(page);
    const afterBase = await snap(page, "C1-after-base-change", report);

    phaseC.steps.push({
      step: "Cambiar base y guardar",
      before: {
        base: baseBefore,
        delta: beforeBaseUi.property?.delta,
        alertas: beforeBaseUi.kpis.alertasDelta,
        recommended: beforeBaseUi.property?.recommended,
      },
      after: {
        base: testBase,
        ui: afterBase,
        delta: afterBase.property?.delta,
        alertas: afterBase.kpis.alertasDelta,
        recommended: afterBase.property?.recommended,
      },
      instantIndicators: {
        baseInput: afterBase.property?.base === String(testBase),
        backendBase: afterBase.backend.canonical.base === testBase,
        headerSyncUpdated:
          afterBase.kpis.headerUltimaSync !== beforeBaseUi.kpis.headerUltimaSync,
      },
      priceLabsDependent: {
        deltaMayChange: afterBase.property?.delta !== beforeBaseUi.property?.delta,
        recommendedMayChange:
          afterBase.property?.recommended !== beforeBaseUi.property?.recommended,
        note: "Δ y recomendado dependen de refresh PriceLabs (listing_prices); base/min/max son instantáneos",
      },
    });

    phaseC.pass =
      afterBase.backend.canonical.base === testBase &&
      afterBase.property?.base === String(testBase) &&
      afterBase.backend.propertyBase === String(testBase);

    // Revertir remoto y local
    if (apiKey && original.min != null) {
      await pl(apiKey, "/v1/listings", {
        method: "POST",
        body: {
          listings: [
            {
              id: LISTING_ID,
              pms: "airbnb",
              min: original.min,
              base: original.base,
              max: original.max ?? null,
            },
          ],
        },
      });
    }
    await gotoRevenue(page);
    await setRowInputs(page, {
      min: original.min ?? "",
      base: original.base ?? "",
      max: original.max != null && original.max > 0 ? String(original.max) : "",
    });
    await savePropertyRow(page);
    await snap(page, "99-reverted", report);

    const allPass = phaseA.pass && phaseB.pass && phaseC.pass;
    report.verdict = allPass
      ? "UI VALIDATION PASS — frontend y backend alineados en las 3 fases"
      : "UI VALIDATION FAIL — revisar fases con pass=false";
    report.completedAt = new Date().toISOString();

    const reportPath = join(SCREENSHOT_DIR, "report.json");
    await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = allPass ? 0 : 1;
  } finally {
    await browser.close();
    await db.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
