import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import { generatePurchaseCode, generateSaleCode } from "@/domains/retail/lib/codes";
import { formatCop, roundMoney, toNumber } from "@/domains/retail/lib/money";

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(full);
  }
  return files;
}

describe("retail money helpers", () => {
  it("parses and rounds money", () => {
    assert.equal(toNumber("10.555"), 10.555);
    assert.equal(roundMoney(10.555), 10.56);
    assert.equal(roundMoney("99.994"), 99.99);
  });

  it("formats COP", () => {
    const formatted = formatCop(1500);
    assert.match(formatted, /1\.500|1500/);
  });
});

describe("retail codes", () => {
  it("generates distinct sale and purchase codes", () => {
    const sale = generateSaleCode();
    const purchase = generatePurchaseCode();
    assert.ok(sale.startsWith("V-") || sale.includes("V") || sale.length > 4);
    assert.ok(purchase.length > 4);
    assert.notEqual(generateSaleCode(), generateSaleCode());
  });
});

describe("retail domain isolation", () => {
  it("does not import PMS business modules", async () => {
    const root = path.join(process.cwd(), "src", "domains", "retail");
    const files = await walk(root);
    const forbidden = [
      /@\/modules\//,
      /@\/features\/(?!retail)/,
      /@\/services\/(reservations|properties|finance|calendar|airbnb|ttlock|cleaning|guests)\b/,
      /@\/lib\/(billing|finance)\b/,
      /from ["']@\/app\/\(dashboard\)/,
    ];
    const violations: string[] = [];
    for (const file of files) {
      const source = await readFile(file, "utf8");
      for (const pattern of forbidden) {
        if (pattern.test(source)) {
          violations.push(`${path.relative(process.cwd(), file)} matches ${pattern}`);
        }
      }
    }
    assert.deepEqual(violations, []);
  });
});
