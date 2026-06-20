import type { NovedadesTimelineEntry, NovedadesTimelineKind } from "@/services/novedades/novedades-inbox.types";

export type InboxActivityGroup = {
  id: string;
  kind: NovedadesTimelineKind;
  title: string;
  count: number;
  entries: NovedadesTimelineEntry[];
  latestAt: string;
  narrative: string;
  amountLabel: string | null;
};

const GROUPABLE_KINDS = new Set<NovedadesTimelineKind>([
  "MODIFICATION_REQUEST",
  "MODIFICATION_APPROVED",
  "RESERVATION_UPDATED",
  "PAYMENT_CONFIRMED",
  "GUEST_REGISTRATION",
]);

function groupTitle(kind: NovedadesTimelineKind, count: number, sample: NovedadesTimelineEntry): string {
  if (count <= 1) return sample.title;

  const labels: Partial<Record<NovedadesTimelineKind, string>> = {
    MODIFICATION_REQUEST: "solicitudes de cambio",
    MODIFICATION_APPROVED: "cambios confirmados",
    RESERVATION_UPDATED: "actualizaciones de reserva",
    PAYMENT_CONFIRMED: "pagos recibidos",
    GUEST_REGISTRATION: "actualizaciones de registro",
  };

  const phrase = labels[kind] ?? "eventos";
  return `${count} ${phrase}`;
}

/** Agrupa eventos repetidos del mismo tipo para reducir ruido en Actividad. */
export function groupInboxActivityEntries(
  entries: NovedadesTimelineEntry[],
): InboxActivityGroup[] {
  const sorted = [...entries].sort((a, b) => {
    const byTime = a.createdAt.localeCompare(b.createdAt);
    if (byTime !== 0) return byTime;
    return a.id.localeCompare(b.id);
  });

  const groups: InboxActivityGroup[] = [];

  for (const entry of sorted) {
    const previous = groups[groups.length - 1];
    if (
      previous &&
      previous.kind === entry.kind &&
      GROUPABLE_KINDS.has(entry.kind) &&
      previous.count < 5
    ) {
      previous.count += 1;
      previous.entries.push(entry);
      previous.latestAt = entry.createdAt;
      previous.title = groupTitle(entry.kind, previous.count, entry);
      previous.narrative = entry.narrative;
      previous.amountLabel = entry.amountLabel ?? previous.amountLabel;
      continue;
    }

    groups.push({
      id: entry.id,
      kind: entry.kind,
      title: entry.title,
      count: 1,
      entries: [entry],
      latestAt: entry.createdAt,
      narrative: entry.narrative,
      amountLabel: entry.amountLabel ?? null,
    });
  }

  return groups;
}
