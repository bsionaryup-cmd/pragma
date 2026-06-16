"use client";

import { useEffect } from "react";
import { ModuleShellFlow } from "@/components/layout/module-shell";
import { PageHeader } from "@/components/ui/page-header";
import { OperationalFeed } from "@/features/novedades/components/operational-feed";
import { useNovedadesUnread } from "@/features/novedades/components/novedades-unread-provider";
import type { OperationalFeedCard } from "@/services/novedades/operational-feed.types";

type NovedadesPageViewProps = {
  cards: OperationalFeedCard[];
  scopeKey: string;
  latestAt: string | null;
};

export function NovedadesPageView({
  cards,
  scopeKey,
  latestAt,
}: NovedadesPageViewProps) {
  const { markSeen } = useNovedadesUnread();

  useEffect(() => {
    markSeen(latestAt ?? cards[0]?.createdAt ?? null, scopeKey);
  }, [cards, latestAt, markSeen, scopeKey]);

  return (
    <ModuleShellFlow className="bg-background">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-4 pb-8 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Operación"
          title="Novedades"
          description="Actividad de Airbnb y tareas sugeridas: mensajes, reservas, pagos y accesos."
          className="mb-6"
        />
        <OperationalFeed cards={cards} />
      </div>
    </ModuleShellFlow>
  );
}
