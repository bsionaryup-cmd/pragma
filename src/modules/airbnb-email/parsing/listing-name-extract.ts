/**
 * Human-visible Airbnb listing title extraction and validation.
 * Rejects URL paths, href fragments, and internal Airbnb route garbage.
 */

const GARBAGE_LISTING_RE =
  /(?:^s\/\d+|\/rooms\/\d+|\/details\/|safety-info|href=|https?:\/\/|mailto:|unsubscribe|\.png|\.jpg|utm_|click\.|track\.)/i;

const PATH_LIKE_RE = /(?:^|\s)[a-z]?\/?\d{5,}(?:\/|$)|(?:details|safety-info|itinerary|help\/article)/i;

const NON_LISTING_PREFIX_RE =
  /^(?:c[oó]digo de confirmaci[oó]n|confirmation code|hu[eé]sped|guest|viajero|traveler|check-?in|check-?out|llegada|salida|arrival|departure)\s*:?\s*/i;

const LABEL_PREFIX_STRIP_RE =
  /^(?:alojamiento|listing(?:\s+name)?|lugar|where you(?:'|&#39;)?ll stay)\s*:?\s*/i;

export function isPlausibleVisibleListingName(
  value: string | null | undefined,
): boolean {
  if (!value?.trim()) return false;
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (cleaned.length < 8 || cleaned.length > 200) return false;
  if (GARBAGE_LISTING_RE.test(cleaned)) return false;
  if (PATH_LIKE_RE.test(cleaned)) return false;
  if (NON_LISTING_PREFIX_RE.test(cleaned)) return false;
  if (/[<>]/.test(cleaned)) return false;
  if ((cleaned.match(/\//g) ?? []).length >= 2) return false;

  const letters = (cleaned.match(/[A-Za-zÀ-ÿ]/g) ?? []).length;
  if (letters < 10) return false;

  const words = cleaned.split(/\s+/).filter((w) => /[A-Za-zÀ-ÿ]{2,}/.test(w));
  if (words.length < 2) return false;

  return true;
}

export function normalizeVisibleListingName(
  value: string | null | undefined,
): string | null {
  if (!value?.trim()) return null;
  let cleaned = value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
  cleaned = cleaned.replace(LABEL_PREFIX_STRIP_RE, "").trim();
  cleaned = cleaned.replace(/^["'“”]+|["'“”]+$/g, "").trim();
  if (!isPlausibleVisibleListingName(cleaned)) return null;
  return cleaned.slice(0, 200);
}

export function normalizeListingNameForMatch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[|•]/g, " ")
    .replace(/[^a-z0-9áéíóúñü\s-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function scoreVisibleListingCandidate(text: string, source: string): number {
  let score = 0;
  if (source.startsWith("table:")) score += 60;
  if (source.startsWith("section:")) score += 50;
  if (source.startsWith("heading:")) score += 35;
  if (/\|/.test(text)) score += 25;
  if (/\b(loft|apartamento|habitaci[oó]n|vista|suite|panor[aá]mica|laureles|chapinero)\b/i.test(text)) {
    score += 20;
  }
  if (text.length >= 24 && text.length <= 160) score += 15;
  if (/\d{1,2}p\b/i.test(text)) score += 8;
  if (NON_LISTING_PREFIX_RE.test(text)) score -= 100;
  if (/^c[oó]digo de confirmaci[oó]n/i.test(text)) score -= 100;
  if (/\//.test(text)) score -= 80;
  if (/details|safety-info|rooms/i.test(text)) score -= 80;
  return score;
}
