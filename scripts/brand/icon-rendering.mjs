import sharp from "sharp";

/** Remove near-black background; keep gradient P mark pixels. */
export async function stripDarkBackground(input) {
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

/** Slightly bolder strokes so the P reads at 16–32px. */
export async function fattenMarkForFavicon(input) {
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

/** Boost gradient hues for small surfaces and home-screen icons. */
export async function enhanceMarkVibrancy(input, { strong = false } = {}) {
  return sharp(input)
    .modulate({
      brightness: strong ? 1.22 : 1.16,
      saturation: strong ? 1.52 : 1.42,
    })
    .linear(strong ? 1.12 : 1.08, strong ? -16 : -12)
    .png()
    .toBuffer();
}

export function faviconPaddingRatio(size) {
  if (size <= 16) return 0.03;
  if (size <= 32) return 0.05;
  return 0.07;
}

/** Safe-zone padding for installable / home-screen icons. */
export function installPaddingRatio(size, { maskable = false } = {}) {
  if (maskable) {
    if (size >= 512) return 0.18;
    if (size >= 192) return 0.17;
    return 0.16;
  }
  if (size >= 512) return 0.1;
  if (size >= 192) return 0.11;
  return 0.12;
}

async function getAlphaCentroid(pngBuf) {
  const { data, info } = await sharp(pngBuf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let sumX = 0;
  let sumY = 0;
  let weight = 0;

  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 4;
      const alpha = data[i + 3];
      if (alpha > 20) {
        sumX += x * alpha;
        sumY += y * alpha;
        weight += alpha;
      }
    }
  }

  if (weight === 0) {
    return { cx: info.width / 2, cy: info.height / 2 };
  }

  return { cx: sumX / weight, cy: sumY / weight };
}

async function compositeMarkOnCanvas(markAlphaBuf, size, options = {}) {
  const {
    transparent = false,
    paddingRatio = faviconPaddingRatio(size),
    background = transparent
      ? { r: 0, g: 0, b: 0, alpha: 0 }
      : { r: 255, g: 255, b: 255, alpha: 1 },
  } = options;

  const inner = Math.max(1, Math.round(size * (1 - paddingRatio * 2)));
  const innerBuf = await sharp(markAlphaBuf)
    .resize(inner, inner, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  const innerMeta = await sharp(innerBuf).metadata();
  const { cx, cy } = await getAlphaCentroid(innerBuf);
  const left = Math.round(
    (size - innerMeta.width) / 2 + (innerMeta.width / 2 - cx),
  );
  const top = Math.round(
    (size - innerMeta.height) / 2 + (innerMeta.height / 2 - cy),
  );

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background,
    },
  })
    .composite([{ input: innerBuf, left, top }])
    .png({ compressionLevel: 9, force: true });
}

/** Tab favicon sizes — bold mark, tight padding. */
export function renderFaviconIcon(markAlphaBuf, size, { transparent = false } = {}) {
  return compositeMarkOnCanvas(markAlphaBuf, size, {
    transparent,
    paddingRatio: faviconPaddingRatio(size),
    background: transparent
      ? { r: 0, g: 0, b: 0, alpha: 0 }
      : { r: 255, g: 255, b: 255, alpha: 1 },
  });
}

/** PWA / Add-to-home-screen — current mark, optical center, readable scale. */
export function renderInstallAppIcon(installMarkBuf, size, { maskable = false } = {}) {
  return compositeMarkOnCanvas(installMarkBuf, size, {
    transparent: false,
    paddingRatio: installPaddingRatio(size, { maskable }),
    background: { r: 255, g: 255, b: 255, alpha: 1 },
  });
}

export function createIcoFromPngs(entries) {
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

export async function preparePMarkForFavicon(sourceBuf) {
  return stripDarkBackground(sourceBuf)
    .then((img) => img.trim({ threshold: 12 }).png().toBuffer())
    .then((buf) => fattenMarkForFavicon(buf))
    .then((buf) => enhanceMarkVibrancy(buf, { strong: true }));
}

export async function preparePMarkForInstall(sourceBuf) {
  return stripDarkBackground(sourceBuf)
    .then((img) => img.trim({ threshold: 12 }).png().toBuffer())
    .then((buf) => enhanceMarkVibrancy(buf, { strong: false }));
}
