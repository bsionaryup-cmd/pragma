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

export type StoredPriceLabsMeta = {
  listing?: PriceLabsListingRecord;
  dailyPrices?: PriceLabsDailyPrice[];
  overrides?: PriceLabsOverrideRecord[];
  neighborhood?: PriceLabsNeighborhoodResponse;
  lastListingRefresh?: string;
  lastPricesSync?: string;
  matchReason?: string;
  mode?: string;
};
