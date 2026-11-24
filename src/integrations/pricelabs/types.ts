/** PriceLabs Customer API — shared types. */

export type PriceLabsResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; status?: number; code?: string };

export type PriceLabsListingRecord = {
  id: string;
  pms?: string;
  name?: string;
  city?: string;
  country?: string;
  bedrooms?: number;
  min?: number;
  base?: number;
  max?: number;
  recommended_base_price?: number;
  occupancy?: number;
  revenue?: number;
  sync_status?: string;
  last_refreshed?: string;
  /** Último push de límites a canales (PriceLabs API). */
  last_pushed?: string;
  raw?: Record<string, unknown>;
};

export type PriceLabsListingsResponse = {
  listings?: PriceLabsListingRecord[];
  data?: PriceLabsListingRecord[];
};

export type PriceLabsDailyPrice = {
  date: string;
  price?: number;
  user_price?: number;
  recommended_price?: number;
  min_stay?: number;
  weekly_discount?: number;
  monthly_discount?: number;
  booking_status?: string;
  check_in?: boolean;
  check_out?: boolean;
  demand_level?: string;
  demand_color?: string;
  pricing_reason?: string;
  uncustomized_price?: number;
  raw?: Record<string, unknown>;
};

export type PriceLabsListingPricesPayload = {
  id: string;
  pms: string;
  date_from: string;
  date_to: string;
  reason?: boolean;
};

export type PriceLabsListingPricesRequest = {
  listings: PriceLabsListingPricesPayload[];
};

export type PriceLabsListingPricesRow = {
  listing_id?: string;
  id?: string;
  pms?: string;
  currency?: string;
  data?: PriceLabsDailyPrice[];
  prices?: PriceLabsDailyPrice[];
  days?: PriceLabsDailyPrice[];
  error?: string;
  code?: string;
};

export type PriceLabsListingPricesResponse = {
  listings?: PriceLabsListingPricesRow[];
  data?: PriceLabsListingPricesRow[];
};

export type PriceLabsOverrideRecord = {
  date: string;
  price?: number;
  /** Required by PriceLabs when `price` is set (fixed | percent | percent_stacked). */
  price_type?: "fixed" | "percent" | "percent_stacked";
  min_stay?: number;
  min_price?: number;
  max_price?: number;
  check_in?: boolean;
  check_out?: boolean;
  raw?: Record<string, unknown>;
};

export type PriceLabsOverridesResponse = {
  overrides?: PriceLabsOverrideRecord[];
  data?: PriceLabsOverrideRecord[];
};

export type PriceLabsNeighborhoodResponse = Record<string, unknown>;

export type PragmaPropertyForPriceLabs = {
  id: string;
  name: string;
  address: string;
  city: string;
  country: string;
  maxGuests: number;
  bedrooms: number;
  bathrooms: { toString(): string };
  baseRate: { toString(): string } | null;
  currency: string;
};

export type PropertyListingMatch = {
  propertyId: string;
  listingId: string;
  listing: PriceLabsListingRecord;
  matchReason: "listing_id" | "property_id" | "name_city" | "fuzzy";
};

export type PriceLabsSyncListingResult = {
  propertyId: string;
  listingId: string;
  ok: boolean;
  message?: string;
};

export type PriceLabsSyncSummary = {
  synced: number;
  failed: number;
  skipped: number;
  results: PriceLabsSyncListingResult[];
};

export type PriceLabsPricesSummary = {
  updated: number;
  failed: number;
  skipped: number;
  results: Array<{
    propertyId: string;
    listingId: string;
    ok: boolean;
    recommendedRate: number | null;
    priceDelta: number | null;
    weekendUpliftPct: number | null;
    message?: string;
  }>;
};

export type StoredPriceLabsBounds = {
  min?: number | null;
  base?: number | null;
  /** `null` = sin tope explícito (eliminado por el usuario). */
  max?: number | null;
  updatedAt?: string;
};

/** Listing-level PriceLabs customizations (Customer API /v1/customizations/listing). */
export type PriceLabsLastMinuteProfile =
  | "none"
  | "recommended"
  | "conservative"
  | "aggressive"
  | "linear"
  | "linear_gradual"
  | "fixed";

export type PriceLabsFarOutProfile =
  | "none"
  | "recommended"
  | "conservative"
  | "aggressive"
  | "linear"
  | "fix";

export type PriceLabsLastMinuteCustomization = {
  last_min_factor_on: boolean;
  last_min_factor_type?: PriceLabsLastMinuteProfile;
  last_min_factor_value?: number;
  last_min_factor_dfd?: number;
};

export type PriceLabsFarOutCustomization = {
  far_out_premium_on: boolean;
  far_out_premium_type?: PriceLabsFarOutProfile;
  far_out_premium_value?: number;
  far_out_premium_start?: number;
  far_out_premium_step?: number;
};

export type PriceLabsListingCustomizations = {
  last_minute_prices?: PriceLabsLastMinuteCustomization;
  far_out_premium?: PriceLabsFarOutCustomization;
  seasonality?: Record<string, unknown>;
  day_of_week_adjustment?: Record<string, unknown>;
  demand_factor?: Record<string, unknown>;
  /** Unknown keys preserved for round-trip; never invent UI for unsupported specs. */
  [key: string]: unknown;
};

export type StoredPriceLabsMeta = {
  /** Fuente canónica de límites editados desde PRAGMA. */
  bounds?: StoredPriceLabsBounds;
  listing?: PriceLabsListingRecord;
  dailyPrices?: PriceLabsDailyPrice[];
  overrides?: PriceLabsOverrideRecord[];
  neighborhood?: PriceLabsNeighborhoodResponse;
  /** Cached listing customizations (last_minute, far_out, etc.). */
  customizations?: PriceLabsListingCustomizations;
  lastListingRefresh?: string;
  lastPricesSync?: string;
  lastBoundsUpdate?: string;
  lastOverridesSync?: string;
  lastCustomizationsSync?: string;
  lastCustomizationsWriteAt?: string;
  lastCustomizationsWriteSource?: "pragma" | "remote";
  matchReason?: string;
  mode?: string;
};
