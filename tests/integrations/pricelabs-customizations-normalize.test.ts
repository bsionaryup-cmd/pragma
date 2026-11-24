import assert from "node:assert/strict";
import { normalizeListingCustomizations } from "@/integrations/pricelabs/normalize";

const nested = normalizeListingCustomizations({
  customizations: {
    last_minute_prices: {
      last_min_factor_on: true,
      last_min_factor_type: "recommended",
    },
    far_out_premium: { far_out_premium_on: false },
  },
});

assert.equal(
  (nested.last_minute_prices as { last_min_factor_on?: boolean })
    ?.last_min_factor_on,
  true,
);
assert.equal(
  (nested.last_minute_prices as { last_min_factor_type?: string })
    ?.last_min_factor_type,
  "recommended",
);
assert.equal(
  (nested.far_out_premium as { far_out_premium_on?: boolean })
    ?.far_out_premium_on,
  false,
);

const flat = normalizeListingCustomizations({
  last_minute_prices: { last_min_factor_on: false },
});
assert.equal(
  (flat.last_minute_prices as { last_min_factor_on?: boolean })?.last_min_factor_on,
  false,
);

const empty = normalizeListingCustomizations(null);
assert.deepEqual(empty, {});

console.log("pricelabs-customizations.normalize: ok");
