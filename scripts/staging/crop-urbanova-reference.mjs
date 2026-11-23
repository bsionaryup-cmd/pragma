import sharp from "sharp";
import { resolve } from "node:path";

const src = resolve("public/web-builder/urbanova/reference-full.jpg");
const out = resolve("public/web-builder/urbanova");

await sharp(src)
  .extract({ left: 40, top: 95, width: 600, height: 280 })
  .jpeg({ quality: 92 })
  .toFile(resolve(out, "hero.jpg"));

const loftY = 555;
const loftH = 130;
const loftW = 148;
const xs = [30, 186, 342, 498];
for (let i = 0; i < 4; i += 1) {
  await sharp(src)
    .extract({ left: xs[i], top: loftY, width: loftW, height: loftH })
    .jpeg({ quality: 92 })
    .toFile(resolve(out, `loft-80${i + 1}.jpg`));
}

await sharp(src)
  .extract({ left: 340, top: 768, width: 310, height: 150 })
  .jpeg({ quality: 92 })
  .toFile(resolve(out, "location.jpg"));

console.log(JSON.stringify({ ok: true, out }, null, 2));
