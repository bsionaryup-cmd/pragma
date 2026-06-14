import type {
  PriceLabsListingRecord,
  StoredPriceLabsBounds,
  StoredPriceLabsMeta,
} from "@/integrations/pricelabs/types";

export function hasCanonicalBounds(
  meta: StoredPriceLabsMeta | null | undefined,
): boolean {
  return meta?.bounds?.updatedAt != null;
}

export function isMeaningfulMaxRate(
  value: number | null | undefined,
): value is number {
  return value != null && value > 0;
}

export function mergeListingWithCanonicalBounds(
  priorMeta: StoredPriceLabsMeta,
  remoteListing: PriceLabsListingRecord,
): PriceLabsListingRecord {
  if (!hasCanonicalBounds(priorMeta)) {
    return remoteListing;
  }

  const bounds = priorMeta.bounds!;
  const merged: PriceLabsListingRecord = { ...remoteListing };

  if (bounds.min != null) {
    merged.min = bounds.min;
  }
  if (bounds.base != null) {
    merged.base = bounds.base;
  }
  if (bounds.max === null) {
    delete merged.max;
  } else if (isMeaningfulMaxRate(bounds.max)) {
    merged.max = bounds.max;
  }

  return merged;
}

export function parseListingRemoteTimestamp(
  listing: PriceLabsListingRecord,
): number | null {
  const raw = listing.raw ?? {};
  const candidates = [
    listing.last_pushed,
    typeof raw.last_date_pushed === "string" ? raw.last_date_pushed : null,
    listing.last_refreshed,
    typeof raw.last_refreshed_at === "string" ? raw.last_refreshed_at : null,
  ];
  for (const iso of candidates) {
    if (!iso) continue;
    const t = new Date(iso).getTime();
    if (Number.isFinite(t)) return t;
  }
  return null;
}

function resolveRemoteMaxValue(
  max: number | null | undefined,
): number | null | undefined {
  if (max === undefined) return undefined;
  return isMeaningfulMaxRate(max) ? max : null;
}

export function remoteBoundsChanged(
  remote: PriceLabsListingRecord,
  bounds: StoredPriceLabsBounds,
): boolean {
  if (remote.min != null && remote.min !== bounds.min) return true;
  if (remote.base != null && remote.base !== bounds.base) return true;
  const remoteMax = resolveRemoteMaxValue(remote.max);
  if (remoteMax !== undefined && remoteMax !== bounds.max) return true;
  return false;
}

function boundsFromListingSnapshot(
  listing: PriceLabsListingRecord | undefined,
): StoredPriceLabsBounds | null {
  if (!listing) return null;
  const max = resolveRemoteMaxValue(listing.max);
  return {
    min: listing.min ?? null,
    base: listing.base ?? null,
    max: max === undefined ? null : max,
  };
}

/** El GET remoto difiere del snapshot local guardado en meta.listing. */
export function remoteDiffersFromStoredListing(
  remote: PriceLabsListingRecord,
  priorMeta: StoredPriceLabsMeta,
): boolean {
  const snapshot = boundsFromListingSnapshot(priorMeta.listing);
  if (!snapshot) return false;
  return remoteBoundsChanged(remote, snapshot);
}

function buildBoundsFromRemoteListing(
  priorMeta: StoredPriceLabsMeta,
  remoteListing: PriceLabsListingRecord,
  updatedAtIso: string,
): StoredPriceLabsBounds {
  const remoteMax = resolveRemoteMaxValue(remoteListing.max);
  return {
    updatedAt: updatedAtIso,
    min: remoteListing.min ?? priorMeta.bounds?.min ?? null,
    base: remoteListing.base ?? priorMeta.bounds?.base ?? null,
    max:
      remoteMax === undefined
        ? (priorMeta.bounds?.max ?? null)
        : remoteMax,
  };
}

function listingFromBounds(
  remoteListing: PriceLabsListingRecord,
  bounds: StoredPriceLabsBounds,
): PriceLabsListingRecord {
  const listing: PriceLabsListingRecord = { ...remoteListing };
  if (bounds.min != null) listing.min = bounds.min;
  else delete listing.min;
  if (bounds.base != null) listing.base = bounds.base;
  if (bounds.max === null) delete listing.max;
  else if (isMeaningfulMaxRate(bounds.max)) listing.max = bounds.max;
  return listing;
}

export type ListingBoundsSyncResolution = {
  listing: PriceLabsListingRecord;
  bounds?: StoredPriceLabsBounds;
  adoptedFromRemote: boolean;
  baseRateToPersist: number | null;
};

export function resolveListingBoundsForSync(
  priorMeta: StoredPriceLabsMeta,
  remoteListing: PriceLabsListingRecord,
): ListingBoundsSyncResolution {
  const remoteTs = parseListingRemoteTimestamp(remoteListing);
  const localTs = priorMeta.bounds?.updatedAt
    ? new Date(priorMeta.bounds.updatedAt).getTime()
    : null;

  if (
    hasCanonicalBounds(priorMeta) &&
    priorMeta.bounds != null &&
    remoteBoundsChanged(remoteListing, priorMeta.bounds) &&
    (remoteTs == null ||
      localTs == null ||
      remoteTs > localTs ||
      remoteDiffersFromStoredListing(remoteListing, priorMeta))
  ) {
    const bounds = buildBoundsFromRemoteListing(
      priorMeta,
      remoteListing,
      new Date(remoteTs ?? Date.now()).toISOString(),
    );
    return {
      listing: listingFromBounds(remoteListing, bounds),
      bounds,
      adoptedFromRemote: true,
      baseRateToPersist:
        bounds.base != null ? Math.round(bounds.base) : null,
    };
  }

  if (!hasCanonicalBounds(priorMeta)) {
    const ts = remoteTs ?? Date.now();
    const bounds = buildBoundsFromRemoteListing(
      priorMeta,
      remoteListing,
      new Date(ts).toISOString(),
    );
    return {
      listing: listingFromBounds(remoteListing, bounds),
      bounds,
      adoptedFromRemote: true,
      baseRateToPersist:
        bounds.base != null ? Math.round(bounds.base) : null,
    };
  }

  return {
    listing: mergeListingWithCanonicalBounds(priorMeta, remoteListing),
    adoptedFromRemote: false,
    baseRateToPersist: null,
  };
}

/** Desalineación remota vs canónico local sin adopción (para alertas / logs). */
export function detectBoundsDrift(
  priorMeta: StoredPriceLabsMeta,
  remoteListing: PriceLabsListingRecord,
  resolution: ListingBoundsSyncResolution,
): {
  drifted: boolean;
  reason: "remote_differs_kept_local" | null;
  remote: { min: number | null; base: number | null; max: number | null };
  canonical: { min: number | null; base: number | null; max: number | null };
} {
  const bounds = priorMeta.bounds;
  const remote = {
    min: remoteListing.min ?? null,
    base: remoteListing.base ?? null,
    max: resolveRemoteMaxValue(remoteListing.max) ?? null,
  };
  const canonical = {
    min: bounds?.min ?? null,
    base: bounds?.base ?? null,
    max: bounds?.max ?? null,
  };

  const differs =
    hasCanonicalBounds(priorMeta) &&
    bounds != null &&
    remoteBoundsChanged(remoteListing, bounds);

  const drifted = differs && !resolution.adoptedFromRemote;

  return {
    drifted,
    reason: drifted ? "remote_differs_kept_local" : null,
    remote,
    canonical,
  };
}

export function normalizeRemoteListingRaw(raw: Record<string, unknown>) {
  return {
    id: String(raw.id ?? ""),
    pms: typeof raw.pms === "string" ? raw.pms : "airbnb",
    min: typeof raw.min === "number" ? raw.min : null,
    base: typeof raw.base === "number" ? raw.base : null,
    max: raw.max === null || typeof raw.max === "number" ? raw.max : undefined,
    last_pushed:
      typeof raw.last_date_pushed === "string" ? raw.last_date_pushed : undefined,
    last_refreshed:
      typeof raw.last_refreshed_at === "string" ? raw.last_refreshed_at : undefined,
    raw,
  };
}
