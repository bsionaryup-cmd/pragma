/**
 * 0F-2 — Capture isolated LandingProductScreenshot preview.
 * Output: public/marketing/screenshots/0f-2-preview/
 *
 * Prerequisites: npm run dev
 */
import { config } from "dotenv";
import { mkdir, writeFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";

config();
config({ path: ".env.local", override: true });

const BASE = process.env.NEXT_PUBLIC_DEV_ORIGIN || "http://localhost:3000";
const OUT = join(process.cwd(), "public", "marketing", "screenshots", "0f-2-preview");

async function exportWebp(pngPath, webpPath, quality = 82) {
  const meta = await sharp(pngPath).metadata();
  await sharp(pngPath).webp({ quality, effort: 4 }).toFile(webpPath);
  const { size } = await stat(webpPath);
  return { width: meta.width, height: meta.height, bytes: size };
}

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1280, height: 1600 },
  deviceScaleFactor: 2,
});

await page.goto(`${BASE}/landing-product-screenshot-preview`, {
  waitUntil: "networkidle",
  timeout: 120000,
});
await page.waitForSelector("text=0F-2", { timeout: 60000 });
await page.waitForLoadState("networkidle");
await page.waitForTimeout(2000);

const fullPng = join(OUT, "component-preview-full-2x.png");
await page.screenshot({ path: fullPng, fullPage: true });

const heroSection = page.locator("section", { has: page.getByText("Hero slot") });
const heroPng = join(OUT, "component-hero-slot-2x.png");
await heroSection.screenshot({ path: heroPng });

const showcaseSection = page.locator("section", {
  has: page.getByText("Showcase slot"),
});
const showcasePng = join(OUT, "component-showcase-slot-2x.png");
await showcaseSection.screenshot({ path: showcasePng });

await browser.close();

const heroWebp = join(OUT, "component-hero-slot.webp");
const showcaseWebp = join(OUT, "component-showcase-slot.webp");
const fullWebp = join(OUT, "component-preview-full.webp");

const [heroMeta, showcaseMeta, fullMeta] = await Promise.all([
  exportWebp(heroPng, heroWebp),
  exportWebp(showcasePng, showcaseWebp),
  exportWebp(fullPng, fullWebp),
]);

const report = {
  phase: "0F-2",
  capturedAt: new Date().toISOString(),
  previewRoute: "/landing-product-screenshot-preview",
  outputDir: "public/marketing/screenshots/0f-2-preview/",
  assets: [
    { id: "full", webp: "component-preview-full.webp", ...fullMeta },
    { id: "hero-slot", webp: "component-hero-slot.webp", ...heroMeta },
    { id: "showcase-slot", webp: "component-showcase-slot.webp", ...showcaseMeta },
  ],
  expectedLandingWeight: {
    heroWebp: "~92 KB (panel-command-center-main.webp)",
    showcaseWebp: "~60 KB (calendar-june-mid-main.webp)",
    note: "Component adds only HTML frame; image bytes unchanged from 0F-1b assets.",
  },
};

await writeFile(join(OUT, "manifest.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
