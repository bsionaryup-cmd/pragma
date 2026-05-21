"use client";

import { CalendarCheck, KeyRound, Sparkles, TrendingUp } from "lucide-react";
import { PragmaLogo } from "@/components/brand/pragma-logo";

const kpis = [
  { label: "Check-ins hoy", value: "3", icon: CalendarCheck },
  { label: "Ocupación", value: "82%", icon: TrendingUp },
  { label: "Smart Access", value: "Activo", icon: KeyRound },
  { label: "AI Suggestions", value: "2", icon: Sparkles },
];

export function LandingDashboardMockup() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-pragma-border bg-white shadow-pragma-glow">
      <div className="flex items-center justify-between border-b border-pragma-border bg-pragma-soft-gray px-4 py-3">
        <div className="flex items-center gap-2">
          <PragmaLogo variant="mark" symbolClassName="h-7 w-7" />
          <span className="rounded-md bg-pragma-soft-cyan px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-pragma-electric">
            Command Center
          </span>
        </div>
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-pragma-cyan/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-pragma-aqua/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-pragma-electric/80" />
        </div>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-2">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="rounded-xl border border-pragma-border bg-pragma-light-blue/40 p-3"
            >
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium uppercase tracking-wide text-pragma-mid-gray">
                  {kpi.label}
                </p>
                <Icon className="h-4 w-4 text-pragma-electric" strokeWidth={1.75} />
              </div>
              <p className="mt-2 font-heading text-xl font-semibold text-pragma-black">
                {kpi.value}
              </p>
            </div>
          );
        })}
      </div>

      <div className="border-t border-pragma-border bg-pragma-soft-gray/60 px-4 py-3">
        <div className="flex items-center justify-between text-xs text-pragma-mid-gray">
          <span>Reservas activas · Calendario sync · Integraciones</span>
          <span className="font-medium text-pragma-electric">Live</span>
        </div>
      </div>
    </div>
  );
}
