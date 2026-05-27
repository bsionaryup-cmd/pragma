import { parseAirbnbRoomId } from "@/services/airbnb/airbnb-import.service";

const AIRBNB_URL_RE =
  /https?:\/\/(?:www\.)?(?:[a-z]{2}\.)?airbnb\.[a-z.]+\/[^\s"'<>]+/gi;
const ROOM_PATH_RE = /\/rooms\/(\d{5,})/gi;
const SLUG_PATH_RE = /\/h\/([a-z0-9_-]{3,64})/gi;

export type AirbnbListingRefs = {
  /** Best DB lookup key: slug preferred over numeric. */
  airbnbRoomId: string | null;
  airbnbRoomIdNumeric: string | null;
  airbnbRoomSlugs: string[];
  airbnbListingUrl: string | null;
};

/** Stable listing/room identifiers from email HTML or text (not human labels). */
export function extractAirbnbListingRefs(text: string): AirbnbListingRefs {
  const numericIds = new Set<string>();
  const slugs = new Set<string>();
  let firstListingUrl: string | null = null;

  for (const match of text.matchAll(AIRBNB_URL_RE)) {
    const raw = match[0]?.replace(/[),.;]+$/, "") ?? "";
    if (!raw) continue;

    try {
      const url = new URL(raw);
      const parsed = parseAirbnbRoomId(url.toString());
      if (parsed) {
        if (/^\d+$/.test(parsed)) numericIds.add(parsed);
        else slugs.add(parsed.toLowerCase());
      }

      if (!firstListingUrl && (/\/rooms\/\d+/.test(url.pathname) || /\/h\//.test(url.pathname))) {
        firstListingUrl = url.toString();
      }
    } catch {
      // skip malformed URL
    }
  }

  for (const match of text.matchAll(ROOM_PATH_RE)) {
    const id = match[1];
    if (id) numericIds.add(id);
  }

  for (const match of text.matchAll(SLUG_PATH_RE)) {
    const slug = match[1]?.toLowerCase();
    if (slug) slugs.add(slug);
  }

  const slugList = [...slugs];
  const numericList = [...numericIds];
  const airbnbRoomIdNumeric =
    numericList.length === 1 ? numericList[0]! : numericList.length > 1 ? null : null;

  const airbnbRoomId =
    slugList.length === 1
      ? slugList[0]!
      : slugList.length > 1
        ? null
        : airbnbRoomIdNumeric;

  return {
    airbnbRoomId,
    airbnbRoomIdNumeric,
    airbnbRoomSlugs: slugList,
    airbnbListingUrl: firstListingUrl,
  };
}
