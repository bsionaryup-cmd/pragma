/**
 * Generates PRAGMA brand assets under public/branding/ from official sources.
 * Run: npm run brand:assets
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const brandingDir = path.join(root, "public", "branding");
const manifestIconsDir = path.join(brandingDir, "manifest-icons");
const assetsDir = path.join(
  root,
  "..",
  ".cursor",
  "projects",
  "c-Users-R160-Desktop-pragma-pms",
  "assets",
);

const SOURCE_FILES = {
  logoHorizontal:
    "c__Users_R160_AppData_Roaming_Cursor_User_workspaceStorage_ebe224db981f797734175ce9f72a1fe8_images_ChatGPT_Image_21_may_2026__04_17_58_a.m.-e2582609-6d6f-4091-9255-a38471e37194.png",
  logoStacked:
    "c__Users_R160_AppData_Roaming_Cursor_User_workspaceStorage_ebe224db981f797734175ce9f72a1fe8_images_ChatGPT_Image_20_may_2026__08_18_15_p.m.-887dac3d-8d26-4d03-bd98-45f8a85ad30f.png",
  /** Canonical P mark — May 2026 brand update */
  symbol:
    "c__Users_R160_AppData_Roaming_Cursor_User_workspaceStorage_ebe224db981f797734175ce9f72a1fe8_images_ChatGPT_Image_22_may_2026__07_01_42_a.m.-ca49c1ed-57bf-4d6d-8041-7032d3dace45.png",
};

async function readMarkSource() {
  const localSource = path.join(brandingDir, "logo-p-mark-source.png");
  try {
    return await fs.readFile(localSource);
  } catch {
    return readSource("symbol");
  }
}

async function readSource(key) {
  const fromAssets = path.join(assetsDir, SOURCE_FILES[key]);
  const brandingFallback = {
    logoHorizontal: path.join(brandingDir, "logo-full.png"),
    logoStacked: path.join(brandingDir, "logo-stacked.png"),
    symbol: path.join(brandingDir, "logo-p-mark-source.png"),
  };
  try {
    return await fs.readFile(fromAssets);
  } catch {
    return fs.readFile(brandingFallback[key]);
  }
}

/** Remove near-black background; keep gradient symbol pixels. */
async function stripDarkBackground(input) {
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
  });
}

async function writePng(pipeline, dest) {
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await pipeline.png({ compressionLevel: 9 }).toFile(dest);
  console.log("wrote", path.relative(root, dest));
}

async function trimLogo(buf) {
  return sharp(buf).trim({ threshold: 12 }).png().toBuffer();
}

/** Slightly bolder strokes so the P reads at 16–32px. */
async function fattenMarkForFavicon(input) {
  const meta = await sharp(input).metadata();
  const pad = 2;
  const mark = await sharp(input).png().toBuffer();
  const spread = 1;
  const composites = [];

  for (let dy = -spread; dy <= spread; dy++) {
    for (let dx = -spread; dx <= spread; dx++) {
      composites.push({
        input: mark,
        left: pad + dx,
        top: pad + dy,
      });
    }
  }

  return sharp({
    create: {
      width: meta.width + pad * 2,
      height: meta.height + pad * 2,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .trim({ threshold: 1 })
    .png()
    .toBuffer();
}

/** Same gradient hues — boosted for tab visibility on white background. */
async function enhanceFaviconVibrancy(input) {
  return sharp(input)
    .modulate({ brightness: 1.22, saturation: 1.52 })
    .linear(1.12, -16)
    .png()
    .toBuffer();
}

function faviconPaddingRatio(size) {
  if (size <= 16) return 0.03;
  if (size <= 32) return 0.05;
  return 0.07;
}

async function main() {
  await fs.mkdir(manifestIconsDir, { recursive: true });

  const logoHorizontalBuf = await readSource("logoHorizontal");
  const logoStackedBuf = await readSource("logoStacked");
  const symbolBuf = await readMarkSource();

  const markAlphaBuf = await stripDarkBackground(symbolBuf)
    .then((img) => img.trim({ threshold: 12 }).png().toBuffer());
  const markAlpha = sharp(markAlphaBuf);

  const pMarkAlphaBuf = await fattenMarkForFavicon(markAlphaBuf).then((buf) =>
    enhanceFaviconVibrancy(buf),
  );
  const pMarkAlpha = sharp(pMarkAlphaBuf);

  async function renderPMarkIcon(size, { transparent = false } = {}) {
    const paddingRatio = faviconPaddingRatio(size);
    const inner = Math.max(1, Math.round(size * (1 - paddingRatio * 2)));
    const innerBuf = await pMarkAlpha
      .clone()
      .resize(inner, inner, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();

    const canvasBackground = transparent
      ? { r: 0, g: 0, b: 0, alpha: 0 }
      : { r: 255, g: 255, b: 255, alpha: 1 };

    return sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: canvasBackground,
      },
    }).composite([{ input: innerBuf, gravity: "center" }]);
  }

  function createIcoFromPngs(entries) {
    const count = entries.length;
    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(count, 4);

    let offset = 6 + 16 * count;
    const dirs = [];
    const images = [];

    for (const { size, png } of entries) {
      const dir = Buffer.alloc(16);
      dir.writeUInt8(size >= 256 ? 0 : size, 0);
      dir.writeUInt8(size >= 256 ? 0 : size, 1);
      dir.writeUInt8(0, 2);
      dir.writeUInt8(0, 3);
      dir.writeUInt16LE(1, 4);
      dir.writeUInt16LE(32, 6);
      dir.writeUInt32LE(png.length, 8);
      dir.writeUInt32LE(offset, 12);
      dirs.push(dir);
      images.push(png);
      offset += png.length;
    }

    return Buffer.concat([header, ...dirs, ...images]);
  }

  const logoFullTrimmed = await trimLogo(logoHorizontalBuf);
  const logoStackedTrimmed = await trimLogo(logoStackedBuf);

  await writePng(sharp(logoFullTrimmed), path.join(brandingDir, "logo-full.png"));
  await writePng(
    sharp(logoFullTrimmed).flatten({ background: { r: 244, g: 246, b: 248 } }),
    path.join(brandingDir, "logo-full-light.png"),
  );
  await writePng(sharp(logoStackedTrimmed), path.join(brandingDir, "logo-stacked.png"));
  await writePng(markAlpha, path.join(brandingDir, "logo-mark.png"));
  await writePng(markAlpha, path.join(brandingDir, "logo-p-mark.png"));

  const iconSizes = [
    ["icon-16.png", 16],
    ["icon-32.png", 32],
    ["icon-48.png", 48],
    ["icon-72.png", 72],
    ["icon-96.png", 96],
    ["icon-128.png", 128],
    ["icon-192.png", 192],
    ["icon-512.png", 512],
  ];

  for (const [name, size] of iconSizes) {
    await writePng(
      await renderPMarkIcon(size),
      path.join(manifestIconsDir, name),
    );
  }

  await writePng(
    await renderPMarkIcon(180),
    path.join(brandingDir, "apple-touch-icon.png"),
  );

  const png16 = await (await renderPMarkIcon(16, { transparent: true })).png().toBuffer();
  const png32 = await (await renderPMarkIcon(32, { transparent: true })).png().toBuffer();
  const png48 = await (await renderPMarkIcon(48, { transparent: true })).png().toBuffer();
  await fs.writeFile(
    path.join(brandingDir, "favicon.ico"),
    createIcoFromPngs([
      { size: 16, png: png16 },
      { size: 32, png: png32 },
      { size: 48, png: png48 },
    ]),
  );
  console.log("wrote", path.relative(root, path.join(brandingDir, "favicon.ico")));

  await writePng(
    sharp(logoFullTrimmed).resize(1200, 630, {
      fit: "contain",
      background: { r: 5, g: 10, b: 24, alpha: 1 },
    }),
    path.join(brandingDir, "og-image.png"),
  );

  await writePng(
    markAlpha
      .clone()
      .resize(32, 32, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }),
    path.join(brandingDir, "loader.png"),
  );

  const loaderSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" role="img" aria-label="Cargando">
  <g>
    <animateTransform attributeName="transform" type="rotate" from="0 32 32" to="360 32 32" dur="1.1s" repeatCount="indefinite"/>
    <image href="/branding/logo-mark.png" x="6" y="6" width="52" height="52" preserveAspectRatio="xMidYMid meet"/>
  </g>
</svg>`;
  await fs.writeFile(path.join(brandingDir, "loader.svg"), loaderSvg);

  await writePng(
    await renderPMarkIcon(32, { transparent: true }),
    path.join(root, "src", "app", "icon.png"),
  );
  await fs.copyFile(
    path.join(brandingDir, "apple-touch-icon.png"),
    path.join(root, "src", "app", "apple-icon.png"),
  );

  console.log("Branding assets ready under public/branding/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
