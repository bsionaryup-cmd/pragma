import {
  Building2,
  CalendarCheck,
  CalendarX,
  Percent,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardStats } from "@/services/dashboard/dashboard.service";

type StatsGridProps = { stats: DashboardStats };

const items = [
  { key: "activeReservations" as const, label: "Reservas activas", icon: Users },
  { key: "checkInsToday" as const, label: "Check-ins hoy", icon: CalendarCheck },
  { key: "checkOutsToday" as const, label: "Check-outs hoy", icon: CalendarX },
  {
    key: "occupancyRate" as const,
    label: "Ocupación",
    icon: Percent,
    format: (v: number) => `${v}%`,
  },
  {
    key: "totalProperties" as const,
    label: "Propiedades",
    icon: Building2,
    format: (v: number, s: DashboardStats) =>
      `${s.activeProperties}/${v} activas`,
  },
];

export function StatsGrid({ stats }: StatsGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {items.map(({ key, label, icon: Icon, format }) => {
        const raw = stats[key];
        const value = format
          ? key === "totalProperties"
            ? (format as (v: number, s: DashboardStats) => string)(raw as number, stats)
            : (format as (v: number) => string)(raw as number)
          : raw;
        return (
          <Card key={key}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {label}
              </CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-2xl font-semibold tracking-tight">{value}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
