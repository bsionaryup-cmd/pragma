"use client";

import { useEffect } from "react";
import { ModuleShellFlow } from "@/components/layout/module-shell";
import { PageHeader } from "@/components/ui/page-header";
import { OperationalFeed } from "@/features/novedades/components/operational-feed";
import { useNovedadesUnread } from "@/features/novedades/components/novedades-unread-provider";
import type { OperationalFeedView } from "@/services/novedades/operational-feed.types";

type NovedadesPageViewProps = {
  feed: OperationalFeedView;
  scopeKey: string;
  latestAt: string | null;
};

export function NovedadesPageView({
  feed,
  scopeKey,
  latestAt,
}: NovedadesPageViewProps) {
  const { markSeen } = useNovedadesUnread();
  const firstEventAt =
    feed.groups[0]?.latestAt ?? feed.unlinked[0]?.createdAt ?? null;

  useEffect(() => {
    markSeen(latestAt ?? firstEventAt, scopeKey);
  }, [feed, firstEventAt, latestAt, markSeen, scopeKey]);

  return (
    <ModuleShellFlow className="bg-background">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-4 pb-8 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Operación"
          title="Novedades"
          description="Bandeja de actividad por reserva: historial claro de confirmaciones, cambios, pagos y mensajes importantes, sin ruido ni eventos técnicos."
          className="mb-6"
        />
        <OperationalFeed feed={feed} />
      </div>
    </ModuleShellFlow>
  );
}
