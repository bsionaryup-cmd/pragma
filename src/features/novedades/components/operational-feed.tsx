import type { OperationalFeedCard } from "@/services/novedades/operational-feed.types";
import { OperationalFeedCardView } from "@/features/novedades/components/operational-feed-card";
import { EmptyState } from "@/components/ui/empty-state";

type OperationalFeedProps = {
  cards: OperationalFeedCard[];
};

export function OperationalFeed({ cards }: OperationalFeedProps) {
  if (cards.length === 0) {
    return (
      <EmptyState
        title="Sin novedades por ahora"
        description="Aquí aparecen reservas confirmadas, pagos, mensajes de huéspedes y cambios en reservas cuando Airbnb envíe el correo a tu bandeja conectada."
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-1">
      {cards.map((card) => (
        <OperationalFeedCardView key={card.id} card={card} />
      ))}
    </div>
  );
}
