/**
 * Generates PRAGMA brand derivatives from source PNGs (exact logo fidelity).
 * Run: node scripts/generate-brand-assets.mjs
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const brandDir = path.join(root, "public", "brand");
const assetsDir = path.join(
  root,
  "..",
  ".cursor",
  "projects",
  "c-Users-R160-Desktop-pragma-pms",
  "assets",
);

const SOURCE = {
  logoFull:
    "c__Users_R160_AppData_Roaming_Cursor_User_workspaceStorage_ebe224db981f797734175ce9f72a1fe8_images_ChatGPT_Image_20_may_2026__08_18_15_p.m.-887dac3d-8d26-4d03-bd98-45f8a85ad30f.png",
  symbol:
    "c__Users_R160_AppData_Roaming_Cursor_User_workspaceStorage_ebe224db981f797734175ce9f72a1fe8_images_ChatGPT_Image_20_may_2026__08_20_29_p.m.-675572c7-e8df-42b2-9637-bae761f6090b.png",
  symbolMono:
    "c__Users_R160_AppData_Roaming_Cursor_User_workspaceStorage_ebe224db981f797734175ce9f72a1fe8_images_ChatGPT_Image_20_may_2026__08_24_06_p.m.-629110ad-cd09-44f3-aba8-7bb36e786560.png",
};

async function readSource(name) {
  const fromAssets = path.join(assetsDir, SOURCE[name]);
  try {
    return await fs.readFile(fromAssets);
  } catch {
    const fallback = path.join(brandDir, {
      logoFull: "pragma-logo-full.png",
      symbol: "pragma-symbol.png",
      symbolMono: "pragma-symbol-dark.png",
    }[name]);
    return fs.readFile(fallback);
  }
}

/** Remove near-black background; keep gradient symbol pixels. */
async function symbolWithAlpha(input) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = Buffer.from(data);
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const isDarkBg = max < 42 && min < 28;
    if (isDarkBg) {
      pixels[i + 3] = 0;
    } else if (max < 72) {
      pixels[i + 3] = Math.round(((max - 28) / 44) * 255);
    }
  }

  return sharp(pixels, {
    raw: { width: info.width, height: info.height, channels: 4 },
  }).png();
}

async function writePng(pipeline, dest) {
  await pipeline.png().toFile(dest);
  console.log("wrote", path.relative(root, dest));
}

async function writeSvgImage(href, viewW, viewH, dest) {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewW} ${viewH}" role="img" aria-label="PRAGMA">
  <image href="${href}" width="${viewW}" height="${viewH}" preserveAspectRatio="xMidYMid meet"/>
</svg>`;
  await fs.writeFile(dest, svg);
  console.log("wrote", path.relative(root, dest));
}

async function main() {
  await fs.mkdir(brandDir, { recursive: true });

  const logoFullBuf = await readSource("logoFull");
  const symbolBuf = await readSource("symbol");
  const symbolMonoBuf = await readSource("symbolMono");

  await writePng(sharp(logoFullBuf), path.join(brandDir, "pragma-logo-full.png"));
  await writePng(sharp(symbolBuf), path.join(brandDir, "pragma-symbol.png"));
  await writePng(sharp(symbolMonoBuf), path.join(brandDir, "pragma-symbol-dark.png"));

  const symbolAlpha = await symbolWithAlpha(symbolBuf);
  await writePng(symbolAlpha, path.join(brandDir, "pragma-symbol-alpha.png"));

  const sizes = [
    ["pragma-favicon-16.png", 16],
    ["pragma-favicon-32.png", 32],
    ["pragma-pwa-icon.png", 512],
    ["pragma-apple-touch.png", 180],
  ];
  for (const [name, size] of sizes) {
    await writePng(
      symbolAlpha.clone().resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }),
      path.join(brandDir, name),
    );
  }

  await writePng(
    sharp(logoFullBuf).resize(1200, 630, {
      fit: "contain",
      background: { r: 248, g: 250, b: 252, alpha: 1 },
    }),
    path.join(brandDir, "pragma-og-image.png"),
  );

  await writeSvgImage("/brand/pragma-logo-full.png", 400, 140, path.join(brandDir, "pragma-logo-full.svg"));
  await writeSvgImage("/brand/pragma-logo-full.png", 400, 140, path.join(brandDir, "pragma-logo-light.svg"));
  await writeSvgImage("/brand/pragma-logo-full.png", 400, 140, path.join(brandDir, "pragma-logo-dark.svg"));
  await writeSvgImage("/brand/pragma-symbol-alpha.png", 64, 64, path.join(brandDir, "pragma-symbol.svg"));

  await fs.copyFile(
    path.join(brandDir, "pragma-favicon-32.png"),
    path.join(brandDir, "pragma-favicon.ico"),
  );
  await fs.copyFile(path.join(brandDir, "pragma-apple-touch.png"), path.join(root, "src", "app", "apple-icon.png"));
  await fs.copyFile(path.join(brandDir, "pragma-pwa-icon.png"), path.join(root, "src", "app", "icon.png"));

  await fs.unlink(path.join(brandDir, "_test.png")).catch(() => {});

  console.log("Brand assets ready.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
