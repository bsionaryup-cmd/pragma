/**
 * 0F final — Landing hero + showcase captures at review viewports.
 * Output: public/marketing/screenshots/0f-final/
 */
import { config } from "dotenv";
import { mkdir, writeFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { chromium, devices } from "playwright";
import sharp from "sharp";

config();
config({ path: ".env.local", override: true });

const BASE = process.env.NEXT_PUBLIC_DEV_ORIGIN || "http://localhost:3000";
const OUT = join(process.cwd(), "public", "marketing", "screenshots", "0f-final");

const VIEWPORTS = [
  { id: "desktop-1440", width: 1440, height: 900 },
  { id: "desktop-1280", width: 1280, height: 800 },
  { id: "ipad", ...devices["iPad (gen 7)"].viewport, deviceScaleFactor: 2 },
  { id: "iphone", ...devices["iPhone 13"].viewport, deviceScaleFactor: 3 },
];

async function exportWebp(pngPath, webpPath) {
  await sharp(pngPath).webp({ quality: 82, effort: 4 }).toFile(webpPath);
  const { size } = await stat(webpPath);
  return size;
}

async function captureSection(page, selector, path) {
  const el = page.locator(selector).first();
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await el.screenshot({ path });
}

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const manifest = [];

for (const vp of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.deviceScaleFactor ?? 1,
    isMobile: vp.id === "iphone",
    hasTouch: vp.id === "iphone" || vp.id === "ipad",
  });
  const page = await context.newPage();

  await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForSelector("text=Todo tu negocio", { timeout: 30000 });

  const heroPng = join(OUT, `${vp.id}-hero.png`);
  const showcasePng = join(OUT, `${vp.id}-showcase.png`);
  const fullPng = join(OUT, `${vp.id}-landing-full.png`);

  await captureSection(page, "main section:first-of-type", heroPng);
  await captureSection(page, "#product", showcasePng);
  await page.screenshot({ path: fullPng, fullPage: true });

  const heroWebp = join(OUT, `${vp.id}-hero.webp`);
  const showcaseWebp = join(OUT, `${vp.id}-showcase.webp`);
  const [heroBytes, showcaseBytes] = await Promise.all([
    exportWebp(heroPng, heroWebp),
    exportWebp(showcasePng, showcaseWebp),
  ]);

  manifest.push({
    viewport: vp.id,
    width: vp.width,
    height: vp.height,
    hero: { png: `${vp.id}-hero.png`, webpBytes: heroBytes },
    showcase: { png: `${vp.id}-showcase.png`, webpBytes: showcaseBytes },
    full: `${vp.id}-landing-full.png`,
  });

  await context.close();
}

await browser.close();

const report = {
  phase: "0F-final",
  capturedAt: new Date().toISOString(),
  baseUrl: BASE,
  outputDir: "public/marketing/screenshots/0f-final/",
  viewports: manifest,
};

await writeFile(join(OUT, "manifest.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
