import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

describe("PriceLabs Tarifas sync lock coupling", () => {
  it("revenue panel bounds/overrides actions do not wrap with sync lock", () => {
    const path = resolve(
      process.cwd(),
      "src/features/revenue/actions/smartprice.actions.ts",
    );
    const src = readFileSync(path, "utf8");
    assert.match(src, /savePropertyPriceBoundsAction/);
    assert.match(src, /runRevenueMutation/);
    // Panel mutations must call runRevenueMutation without lock.
    const boundsBlock = src.slice(
      src.indexOf("export async function savePropertyPriceBoundsAction"),
      src.indexOf("export async function savePriceLabsOverrideAction"),
    );
    assert.doesNotMatch(boundsBlock, /runWithPriceLabsSyncLock/);
    assert.match(boundsBlock, /runRevenueMutation/);
  });

  it("sync lock release uses updateMany and never throws from release path", () => {
    const path = resolve(
      process.cwd(),
      "src/services/integrations/pricelabs/pricelabs-sync-lock.ts",
    );
    const src = readFileSync(path, "utf8");
    assert.match(src, /clearStaleLockRow/);
    assert.match(src, /updateMany/);
    assert.match(src, /releasePriceLabsSyncLock failed/);
  });
});
