/**
 * Regenerates PRAGMA favicon + app icon assets from the canonical P brand mark.
 * Source of truth: public/branding/logo-p-mark.png (or logo-p-mark-source.png)
 * Run: npm run brand:favicon
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const brandingDir = path.join(root, "public", "branding");
const manifestIconsDir = path.join(brandingDir, "manifest-icons");
const pMarkSource = path.join(brandingDir, "logo-p-mark.png");
const pMarkSourceFallback = path.join(brandingDir, "logo-p-mark-source.png");

/** Remove near-black background; keep gradient P mark pixels. */
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

async function preparePMarkAlpha() {
  let source;
  try {
    source = await fs.readFile(pMarkSource);
  } catch {
    source = await fs.readFile(pMarkSourceFallback);
  }
  return stripDarkBackground(source)
    .then((img) => img.trim({ threshold: 12 }).png().toBuffer())
    .then((buf) => fattenMarkForFavicon(buf))
    .then((buf) => enhanceFaviconVibrancy(buf));
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

async function renderPMarkIcon(pMarkAlphaBuf, size, { transparent = false } = {}) {
  const paddingRatio = faviconPaddingRatio(size);
  const inner = Math.max(1, Math.round(size * (1 - paddingRatio * 2)));
  const innerBuf = await sharp(pMarkAlphaBuf)
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
  })
    .composite([{ input: innerBuf, gravity: "center" }])
    .png({ compressionLevel: 9, force: true });
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

async function writePng(pipeline, dest) {
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await pipeline.png({ compressionLevel: 9 }).toFile(dest);
  console.log("wrote", path.relative(root, dest));
}

async function main() {
  await fs.mkdir(manifestIconsDir, { recursive: true });

  const pMarkAlphaBuf = await preparePMarkAlpha();

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
      await renderPMarkIcon(pMarkAlphaBuf, size),
      path.join(manifestIconsDir, name),
    );
  }

  await writePng(
    await renderPMarkIcon(pMarkAlphaBuf, 180),
    path.join(brandingDir, "apple-touch-icon.png"),
  );

  const png16 = await (await renderPMarkIcon(pMarkAlphaBuf, 16, { transparent: true })).png().toBuffer();
  const png32 = await (await renderPMarkIcon(pMarkAlphaBuf, 32, { transparent: true })).png().toBuffer();
  const png48 = await (await renderPMarkIcon(pMarkAlphaBuf, 48, { transparent: true })).png().toBuffer();
  const faviconIco = createIcoFromPngs([
    { size: 16, png: png16 },
    { size: 32, png: png32 },
    { size: 48, png: png48 },
  ]);
  await fs.writeFile(path.join(brandingDir, "favicon.ico"), faviconIco);
  console.log("wrote", path.relative(root, path.join(brandingDir, "favicon.ico")));

  await writePng(
    await renderPMarkIcon(pMarkAlphaBuf, 32, { transparent: true }),
    path.join(root, "src", "app", "icon.png"),
  );

  console.log("wrote", "src/app/icon.png");

  await fs.copyFile(
    path.join(brandingDir, "apple-touch-icon.png"),
    path.join(root, "src", "app", "apple-icon.png"),
  );
  console.log("wrote", "src/app/apple-icon.png");

  console.log("Favicon assets generated from logo-p-mark.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
