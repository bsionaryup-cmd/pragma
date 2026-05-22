"use client";

import Link from "next/link";
import {
  DEMO_KPIS,
  DEMO_PROPERTIES,
  DEMO_RESERVATIONS,
} from "@/services/demo/demo-fixtures";
import { APP_DEMO_CTA } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function DemoSandboxView() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6">
      <div className="rounded-2xl border border-pragma-cyan/30 bg-pragma-light-blue/30 px-4 py-3 text-center text-sm">
        <span className="font-medium">Modo demo</span>
        <span className="text-muted-foreground">
          {" "}
          · datos de ejemplo · sin afectar tu operación real
        </span>
        <Button variant="brand" size="sm" className="ml-3" asChild>
          <Link href="/sign-up">{APP_DEMO_CTA}</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Ocupación", value: `${DEMO_KPIS.occupancy}%` },
          {
            label: "Ingresos mes",
            value: `$${(DEMO_KPIS.revenueMonth / 1_000_000).toFixed(1)}M`,
          },
          { label: "Check-in hoy", value: String(DEMO_KPIS.arrivalsToday) },
          { label: "Check-out hoy", value: String(DEMO_KPIS.departuresToday) },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-xs text-muted-foreground">{kpi.label}</p>
            <p className="font-heading mt-1 text-2xl font-bold tabular-nums">{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="font-heading text-lg font-semibold">Propiedades</h2>
          <ul className="mt-4 divide-y">
            {DEMO_PROPERTIES.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-muted-foreground">{p.city}</p>
                </div>
                <Badge variant="outline">{p.occupancy}% occ.</Badge>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="font-heading text-lg font-semibold">Próximas reservas</h2>
          <ul className="mt-4 divide-y">
            {DEMO_RESERVATIONS.map((r) => {
              const property = DEMO_PROPERTIES.find((p) => p.id === r.propertyId);
              return (
                <li key={r.id} className="py-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{r.guestName}</p>
                    <Badge
                      variant={r.status === "confirmed" ? "default" : "outline"}
                    >
                      {r.status}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground">
                    {property?.name} · {r.checkIn} → {r.checkOut}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="text-center">
        <Button variant="brand" size="lg" asChild>
          <Link href="/sign-up">Activar cuenta real</Link>
        </Button>
      </div>
    </div>
  );
}
