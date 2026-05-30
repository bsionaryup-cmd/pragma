import type { ReservationEventFeedRow } from "@/services/reservation-events/reservation-events-list.service";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type NovedadesFeedProps = {
  rows: ReservationEventFeedRow[];
};

function badgeVariant(
  eventType: ReservationEventFeedRow["eventType"],
): "default" | "secondary" {
  return eventType === "MODIFICATION_REQUEST" ? "secondary" : "default";
}

export function NovedadesFeed({ rows }: NovedadesFeedProps) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="Sin novedades registradas"
        description="Los correos Airbnb de solicitud o aprobación de cambios se registran aquí automáticamente al procesarse (reenvío o llegada original vía Resend)."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[13%]">Fecha</TableHead>
            <TableHead className="w-[12%]">Tipo</TableHead>
            <TableHead className="w-[14%]">Propiedad</TableHead>
            <TableHead className="w-[12%]">Huésped</TableHead>
            <TableHead className="w-[12%]">Clasificación</TableHead>
            <TableHead>Descripción</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="text-xs text-muted-foreground">
                {row.createdAtFormatted}
              </TableCell>
              <TableCell>
                <Badge variant={badgeVariant(row.eventType)}>{row.eventTypeLabel}</Badge>
              </TableCell>
              <TableCell className="text-sm">{row.propertyName ?? "—"}</TableCell>
              <TableCell className="text-sm">{row.guestName ?? "—"}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {row.classificationLabel}
              </TableCell>
              <TableCell className="text-sm text-foreground/85">
                <p>{row.description}</p>
                {row.rawSubject ? (
                  <p className="mt-1 truncate text-[11px] text-muted-foreground">
                    Asunto: {row.rawSubject}
                  </p>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
