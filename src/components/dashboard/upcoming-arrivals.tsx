import { ReservationSourceBadge } from "@/components/reservations/reservation-source-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrency } from "@/lib/helpers";
import { formatDate } from "@/lib/helpers/date";
import type { getUpcomingArrivals } from "@/services/dashboard/dashboard.service";

type Arrival = Awaited<ReturnType<typeof getUpcomingArrivals>>[number];

export function UpcomingArrivals({ arrivals }: { arrivals: Arrival[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Próximas llegadas</CardTitle>
        <CardDescription>Próximos 7 días</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {arrivals.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Sin llegadas próximas
          </p>
        ) : (
          arrivals.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between rounded-lg border border-border p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{a.guestName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {a.property.name} · {formatDate(a.checkIn)}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <ReservationSourceBadge platform={a.platform} />
                <span className="text-xs font-medium">
                  {formatCurrency(Number(a.totalAmount))}
                </span>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
