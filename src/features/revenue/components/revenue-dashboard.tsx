import Link from "next/link";
import { LineChart, TrendingDown, TrendingUp } from "lucide-react";
import type { RevenueDashboardDto } from "@/services/revenue/revenue-dashboard.service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type RevenueDashboardProps = {
  data: RevenueDashboardDto;
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function RevenueDashboard({ data }: RevenueDashboardProps) {
  const { priceLabs, finance, billingLocked } = data;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#0E9F8D]">
            Revenue
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Motor de ingresos</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            PriceLabs, ocupación y deltas de precio — vista consolidada PRAGMA.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/calendar">Calendario</Link>
          </Button>
          {!billingLocked ? (
            <Button asChild size="sm" className="bg-[#0E9F8D] hover:bg-[#0c8a7a]">
              <Link href="/integrations/pricelabs">PriceLabs</Link>
            </Button>
          ) : null}
        </div>
      </header>

      {billingLocked ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Modo restringido: puedes consultar métricas; sincronización y edición de precios
          están pausadas hasta regularizar el pago.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Listings sync"
          value={`${priceLabs.syncedCount}/${priceLabs.propertyCount}`}
        />
        <StatCard
          label="Último sync precios"
          value={formatDate(priceLabs.lastPricesSyncAt)}
        />
        <StatCard
          label="Subprecio"
          value={String(priceLabs.underpricedCount)}
          warn
          icon={<TrendingDown className="h-4 w-4" />}
        />
        <StatCard
          label="Sobre precio"
          value={String(priceLabs.overpricedCount)}
          icon={<TrendingUp className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <LineChart className="h-4 w-4 text-[#0E9F8D]" />
              PriceLabs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row
              label="Estado"
              value={
                <Badge variant="outline">
                  {priceLabs.configured
                    ? priceLabs.connected
                      ? "Conectado"
                      : "Configurado"
                    : "Sin API key"}
                </Badge>
              }
            />
            <Row label="Delta promedio" value={priceLabs.avgDelta ?? "—"} />
            <Row label="Overrides" value={priceLabs.overridesHint} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Operación (mes actual)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {finance ? (
              <>
                <Row label="Ingresos" value={finance.monthlyRevenue ?? "—"} />
                <Row label="Ocupación" value={finance.occupancyRate ?? "—"} />
                <Row label="Ticket medio" value={finance.adr ?? "—"} />
              </>
            ) : (
              <p className="text-muted-foreground">Sin datos financieros.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  warn,
  icon,
}: {
  label: string;
  value: string;
  warn?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <Card className="border-border/80">
      <CardContent className="pt-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={`mt-1 flex items-center gap-2 text-lg font-semibold tabular-nums ${warn ? "text-amber-600" : ""}`}
        >
          {icon}
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
