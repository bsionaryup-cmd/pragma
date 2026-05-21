import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const brandingDir = path.resolve(__dirname, "../../public/branding");
const sourcePath = path.join(brandingDir, "logo-source.png");
const tempPath = path.join(brandingDir, "_logo-processing.png");
const tempTrimPath = path.join(brandingDir, "_logo-trimmed.png");

const BLACK_CUTOFF = 42;

function isBackgroundPixel(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max - min;
  if (max <= BLACK_CUTOFF) return true;
  if (saturation < 18 && max > 175) return true;
  return false;
}

function liftDarkText(r, g, b) {
  const isBlueText =
    b > r + 8 && b > g + 4 && r < 90 && g < 110 && b > 45 && b < 150;
  if (!isBlueText) return [r, g, b];
  return [
    Math.min(255, r + 95),
    Math.min(255, g + 115),
    Math.min(255, b + 130),
  ];
}

async function removeBlackBackground(inputPath, { liftText = false } = {}) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const max = Math.max(r, g, b);

    if (isBackgroundPixel(r, g, b)) {
      data[i + 3] = 0;
      continue;
    }

    if (max <= BLACK_CUTOFF + 32) {
      const t = (max - BLACK_CUTOFF) / 32;
      data[i + 3] = Math.round(Math.min(255, data[i + 3] * t));
    }

    if (liftText && data[i + 3] > 0) {
      const [nr, ng, nb] = liftDarkText(r, g, b);
      data[i] = nr;
      data[i + 1] = ng;
      data[i + 2] = nb;
    }
  }

  await sharp(data, { raw: { width, height, channels } }).png().toFile(tempPath);
  await sharp(tempPath).trim({ threshold: 12 }).png().toFile(tempTrimPath);
  return sharp(tempTrimPath).metadata();
}

async function saveFromTemp(outName) {
  const outPath = path.join(brandingDir, outName);
  await sharp(tempTrimPath).png().toFile(outPath);
  const meta = await sharp(outPath).metadata();
  console.log(`${outName}: ${meta.width}x${meta.height}`);
  return meta;
}

async function writeMarkLogo() {
  const fullPath = path.join(brandingDir, "logo-full.png");
  const fullMeta = await sharp(fullPath).metadata();
  const cropW = Math.min(
    Math.round(fullMeta.width * 0.36),
    fullMeta.width - 2,
  );
  const left = Math.min(
    Math.round(fullMeta.width * 0.02),
    Math.max(0, fullMeta.width - cropW - 1),
  );
  const outPath = path.join(brandingDir, "logo-mark.png");

  await sharp(fullPath)
    .extract({ left, top: 0, width: cropW, height: fullMeta.height })
    .trim({ threshold: 12 })
    .png()
    .toFile(outPath);

  const meta = await sharp(outPath).metadata();
  console.log(`logo-mark.png: ${meta.width}x${meta.height}`);
}

async function main() {
  await removeBlackBackground(sourcePath);
  await saveFromTemp("logo-full.png");
  await saveFromTemp("logo-full-light.png");

  await removeBlackBackground(sourcePath, { liftText: true });
  await saveFromTemp("logo-full-dark.png");

  await writeMarkLogo();
  await fs.unlink(tempPath).catch(() => {});
  await fs.unlink(tempTrimPath).catch(() => {});
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
