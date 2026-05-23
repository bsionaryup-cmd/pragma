/**
 * Regenerates PRAGMA favicon + installable app icon assets from the canonical P mark.
 * Source of truth: public/branding/logo-p-mark.png (or logo-p-mark-source.png)
 * Run: npm run brand:favicon
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createIcoFromPngs,
  preparePMarkForFavicon,
  preparePMarkForInstall,
  renderFaviconIcon,
  renderInstallAppIcon,
} from "./icon-rendering.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const brandingDir = path.join(root, "public", "branding");
const manifestIconsDir = path.join(brandingDir, "manifest-icons");
const pMarkSource = path.join(brandingDir, "logo-p-mark.png");
const pMarkSourceFallback = path.join(brandingDir, "logo-p-mark-source.png");

async function readPMarkSource() {
  try {
    return await fs.readFile(pMarkSource);
  } catch {
    return fs.readFile(pMarkSourceFallback);
  }
}

async function writePng(pipeline, dest) {
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await pipeline.toFile(dest);
  console.log("wrote", path.relative(root, dest));
}

async function main() {
  await fs.mkdir(manifestIconsDir, { recursive: true });

  const sourceBuf = await readPMarkSource();
  const faviconMarkBuf = await preparePMarkForFavicon(sourceBuf);
  const installMarkBuf = await preparePMarkForInstall(sourceBuf);

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
  const faviconIco = createIcoFromPngs([
    { size: 16, png: png16 },
    { size: 32, png: png32 },
    { size: 48, png: png48 },
  ]);
  await fs.writeFile(path.join(brandingDir, "favicon.ico"), faviconIco);
  console.log("wrote", path.relative(root, path.join(brandingDir, "favicon.ico")));

  await fs.copyFile(
    path.join(brandingDir, "favicon.ico"),
    path.join(root, "src", "app", "favicon.ico"),
  );
  console.log("wrote", "src/app/favicon.ico");

  await writePng(
    await renderFaviconIcon(faviconMarkBuf, 32, { transparent: true }),
    path.join(root, "src", "app", "icon.png"),
  );

  await fs.copyFile(
    path.join(brandingDir, "apple-touch-icon.png"),
    path.join(root, "src", "app", "apple-icon.png"),
  );
  console.log("wrote", "src/app/apple-icon.png");

  const publicRootIcons = [
    ["apple-touch-icon.png", path.join(brandingDir, "apple-touch-icon.png")],
    ["apple-touch-icon-precomposed.png", path.join(brandingDir, "apple-touch-icon.png")],
    ["icon-192.png", path.join(manifestIconsDir, "icon-192.png")],
    ["icon-512.png", path.join(manifestIconsDir, "icon-512.png")],
    ["favicon-32x32.png", path.join(manifestIconsDir, "icon-32.png")],
  ];

  for (const [name, source] of publicRootIcons) {
    await fs.copyFile(source, path.join(root, "public", name));
    console.log("wrote", path.join("public", name));
  }

  console.log("Favicon + install app icons generated from logo-p-mark.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
