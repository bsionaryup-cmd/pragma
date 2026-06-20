import { groupOperationalFeedByReservation } from "@/services/novedades/operational-feed.group";
import type { OperationalFeedCard } from "@/services/novedades/operational-feed.types";

export function countInboxAttentionFromFeedCards(cards: OperationalFeedCard[]): number {
  return groupOperationalFeedByReservation(cards).groups.reduce(
    (sum, group) => sum + group.attentionCount,
    0,
  );
}
