import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

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

const FORBIDDEN_PMS = [
  /@\/modules\/(?!qr-mobility|retail-admin|sales-console)/,
  /@\/services\/(reservations|properties|finance|calendar|airbnb|ttlock|cleaning|guests|novedades)\b/,
  /@\/lib\/(billing|finance)\b/,
  /@\/app\/\(dashboard\)/,
  /@\/features\/(billing|integrations|reservations|calendar)\b/,
];

const FORBIDDEN_RETAIL_FROM_PMS = [
  /@\/domains\/retail\b/,
  /@\/modules\/retail-admin\b/,
  /@\/features\/retail-admin\b/,
  /@\/components\/retail-admin\b/,
  /@\/app\/\(retail\)/,
];

describe("architecture isolation audit", () => {
  it("Retail domain never imports PMS", async () => {
    const roots = [
      path.join(process.cwd(), "src", "domains", "retail"),
      path.join(process.cwd(), "src", "modules", "retail-admin"),
      path.join(process.cwd(), "src", "features", "retail-admin"),
      path.join(process.cwd(), "src", "components", "retail-admin"),
      path.join(process.cwd(), "src", "app", "(retail)"),
    ];
    const violations: string[] = [];
    for (const root of roots) {
      let files: string[] = [];
      try {
        files = await walk(root);
      } catch {
        continue;
      }
      for (const file of files) {
        const source = await readFile(file, "utf8");
        for (const pattern of FORBIDDEN_PMS) {
          if (pattern.test(source)) {
            violations.push(`${path.relative(process.cwd(), file)} → ${pattern}`);
          }
        }
      }
    }
    assert.deepEqual(violations, []);
  });

  it("PMS dashboard never imports Retail", async () => {
    const roots = [
      path.join(process.cwd(), "src", "app", "(dashboard)"),
      path.join(process.cwd(), "src", "components", "layout"),
      path.join(process.cwd(), "src", "lib", "navigation.ts"),
    ];
    const violations: string[] = [];
    for (const root of roots) {
      let files: string[] = [];
      try {
        const stat = await readFile(root, "utf8").then(
          () => "file" as const,
          async () => "dir" as const,
        );
        files = stat === "file" ? [root] : await walk(root);
      } catch {
        continue;
      }
      for (const file of files) {
        const source = await readFile(file, "utf8");
        for (const pattern of FORBIDDEN_RETAIL_FROM_PMS) {
          if (pattern.test(source)) {
            violations.push(`${path.relative(process.cwd(), file)} → ${pattern}`);
          }
        }
        if (/\/intiendas\b/.test(source) && !file.includes("proxy")) {
          // PMS nav must not deep-link retail product into tenant shell
          if (file.includes("navigation.ts") || file.includes("sidebar")) {
            violations.push(`${path.relative(process.cwd(), file)} contains /intiendas`);
          }
        }
      }
    }
    assert.deepEqual(violations, []);
  });
});
