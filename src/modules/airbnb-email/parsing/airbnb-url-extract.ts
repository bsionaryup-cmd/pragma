import { parseAirbnbRoomId } from "@/services/airbnb/airbnb-import.service";

const AIRBNB_URL_RE =
  /https?:\/\/(?:www\.)?(?:[a-z]{2}\.)?airbnb\.[a-z.]+\/[^\s"'<>]+/gi;
const ROOM_PATH_RE = /\/rooms\/(\d{5,})/gi;

/** Stable listing/room identifiers from email HTML or text (not human labels). */
export function extractAirbnbListingRefs(text: string): {
  airbnbRoomId: string | null;
  airbnbListingUrl: string | null;
} {
  const roomIds = new Set<string>();
  let firstListingUrl: string | null = null;

  for (const match of text.matchAll(AIRBNB_URL_RE)) {
    const raw = match[0]?.replace(/[),.;]+$/, "") ?? "";
    if (!raw) continue;

    try {
      const url = new URL(raw);
      const pathRoom = url.pathname.match(ROOM_PATH_RE)?.[1];
      if (pathRoom) roomIds.add(pathRoom);

      const parsed = parseAirbnbRoomId(url.toString());
      if (parsed && /^\d+$/.test(parsed)) roomIds.add(parsed);

      if (!firstListingUrl && /\/rooms\/\d+/.test(url.pathname)) {
        firstListingUrl = url.toString();
      }
    } catch {
      // skip malformed URL
    }
  }

  for (const match of text.matchAll(ROOM_PATH_RE)) {
    const id = match[1];
    if (id) roomIds.add(id);
  }

  const airbnbRoomId =
    roomIds.size === 1
      ? [...roomIds][0]!
      : roomIds.size > 1
        ? null
        : null;

  return {
    airbnbRoomId,
    airbnbListingUrl: firstListingUrl,
  };
}
