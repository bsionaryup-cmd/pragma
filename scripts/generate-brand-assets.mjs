/**
 * Generates PRAGMA brand assets under public/branding/ from official sources.
 * Run: npm run brand:assets
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import {
  createIcoFromPngs,
  preparePMarkForFavicon,
  preparePMarkForInstall,
  renderFaviconIcon,
  renderInstallAppIcon,
  stripDarkBackground,
} from "./brand/icon-rendering.mjs";

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

async function writePng(pipeline, dest) {
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await pipeline.png({ compressionLevel: 9 }).toFile(dest);
  console.log("wrote", path.relative(root, dest));
}

async function trimLogo(buf) {
  return sharp(buf).trim({ threshold: 12 }).png().toBuffer();
}

async function main() {
  await fs.mkdir(manifestIconsDir, { recursive: true });

  const logoHorizontalBuf = await readSource("logoHorizontal");
  const logoStackedBuf = await readSource("logoStacked");
  const symbolBuf = await readMarkSource();

  const markAlphaBuf = await stripDarkBackground(symbolBuf)
    .then((img) => img.trim({ threshold: 12 }).png().toBuffer());
  const markAlpha = sharp(markAlphaBuf);

  const faviconMarkBuf = await preparePMarkForFavicon(symbolBuf);
  const installMarkBuf = await preparePMarkForInstall(symbolBuf);

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

  const faviconSizes = [
    ["icon-16.png", 16],
    ["icon-32.png", 32],
    ["icon-48.png", 48],
    ["icon-72.png", 72],
    ["icon-96.png", 96],
    ["icon-128.png", 128],
  ];

  for (const [name, size] of faviconSizes) {
    await writePng(
      await renderFaviconIcon(faviconMarkBuf, size),
      path.join(manifestIconsDir, name),
    );
  }

  const installSizes = [
    ["icon-192.png", 192, false],
    ["icon-512.png", 512, false],
    ["icon-192-maskable.png", 192, true],
    ["icon-512-maskable.png", 512, true],
  ];

  for (const [name, size, maskable] of installSizes) {
    await writePng(
      await renderInstallAppIcon(installMarkBuf, size, { maskable }),
      path.join(manifestIconsDir, name),
    );
  }

  await writePng(
    await renderInstallAppIcon(installMarkBuf, 180),
    path.join(brandingDir, "apple-touch-icon.png"),
  );

  const png16 = await (await renderFaviconIcon(faviconMarkBuf, 16, { transparent: true })).toBuffer();
  const png32 = await (await renderFaviconIcon(faviconMarkBuf, 32, { transparent: true })).toBuffer();
  const png48 = await (await renderFaviconIcon(faviconMarkBuf, 48, { transparent: true })).toBuffer();
  await fs.writeFile(
    path.join(brandingDir, "favicon.ico"),
    createIcoFromPngs([
      { size: 16, png: png16 },
      { size: 32, png: png32 },
      { size: 48, png: png48 },
    ]),
  );
  console.log("wrote", path.relative(root, path.join(brandingDir, "favicon.ico")));

  await fs.copyFile(
    path.join(brandingDir, "favicon.ico"),
    path.join(root, "src", "app", "favicon.ico"),
  );
  console.log("wrote", "src/app/favicon.ico");

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
    await renderFaviconIcon(faviconMarkBuf, 32, { transparent: true }),
    path.join(root, "src", "app", "icon.png"),
  );
  await fs.copyFile(
    path.join(brandingDir, "favicon.ico"),
    path.join(root, "src", "app", "favicon.ico"),
  );
  await fs.copyFile(
    path.join(brandingDir, "apple-touch-icon.png"),
    path.join(root, "src", "app", "apple-icon.png"),
  );

  const publicRootIcons = [
    ["apple-touch-icon.png", path.join(brandingDir, "apple-touch-icon.png")],
    ["apple-touch-icon-precomposed.png", path.join(brandingDir, "apple-touch-icon.png")],
    ["icon-192.png", path.join(manifestIconsDir, "icon-192.png")],
    ["icon-512.png", path.join(manifestIconsDir, "icon-512.png")],
    ["favicon-32x32.png", path.join(manifestIconsDir, "icon-32.png")],
  ];
  for (const [name, source] of publicRootIcons) {
    await fs.copyFile(source, path.join(root, "public", name));
  }

  console.log("Branding assets ready under public/branding/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
