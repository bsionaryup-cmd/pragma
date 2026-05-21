/** PriceLabs Integration API — shared types. */

export type PriceLabsResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; status?: number; code?: string };

export type PriceLabsListingPayload = {
  listing_id: string;
  name: string;
  capacity: {
    guests: number;
    bedrooms: number;
    bathrooms: number;
  };
  location: {
    address: string;
    city: string;
    country: string;
    latitude?: number | null;
    longitude?: number | null;
  };
  pricing: {
    base_price: number | null;
    currency: string;
  };
  metadata?: Record<string, unknown>;
};

export type PriceLabsListingsRequest = {
  listings: PriceLabsListingPayload[];
};

export type PriceLabsListingsResponse = {
  success?: boolean;
  listings?: Array<{
    listing_id: string;
    status?: string;
    message?: string;
  }>;
  message?: string;
};

export type PriceLabsGetPricesRequest = {
  listing_ids: string[];
  /** ISO date YYYY-MM-DD */
  start_date?: string;
  end_date?: string;
};

export type PriceLabsPriceRecommendation = {
  listing_id: string;
  recommended_price?: number;
  base_price?: number;
  price_delta?: number;
  weekend_uplift_pct?: number;
  currency?: string;
  dates?: Array<{
    date: string;
    price: number;
    weekend?: boolean;
  }>;
};

export type PriceLabsGetPricesResponse = {
  success?: boolean;
  prices?: PriceLabsPriceRecommendation[];
  recommendations?: PriceLabsPriceRecommendation[];
  message?: string;
};

export type PriceLabsStatusResponse = {
  success?: boolean;
  status?: string;
  healthy?: boolean;
  message?: string;
  integration?: string;
};

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
