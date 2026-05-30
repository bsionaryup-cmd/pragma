"use client";

import { CalendarDays, KeyRound, ListChecks, RefreshCw, TrendingUp } from "lucide-react";
import { FadeIn, Stagger, StaggerItem } from "@/components/landing/motion";
import { SectionHeading } from "@/components/landing/section-heading";

const flows = [
  {
    icon: RefreshCw,
    title: "Sync Airbnb iCal",
    description: "Importación y sincronización de reservas desde Airbnb.",
  },
  {
    icon: KeyRound,
    title: "Accesos TTLock",
    description: "Generación y seguimiento de códigos por reserva.",
  },
  {
    icon: TrendingUp,
    title: "Tarifas PriceLabs",
    description: "Conexión API, mapeo de listings y calendario de precios.",
  },
  {
    icon: ListChecks,
    title: "Tareas operativas",
    description: "Checklists y seguimiento ligados a propiedades y reservas.",
  },
];

export function LandingAutomation() {
  return (
    <section id="automation" className="border-t border-pragma-border bg-pragma-navy py-16 text-white md:py-24">
      <div className="mx-auto max-w-7xl px-6">
        <FadeIn>
          <SectionHeading
            eyebrow="Operación"
            title="Flujos reales que ya puedes usar hoy."
            description="Menos saltos entre herramientas: sync, accesos, tarifas y tareas en el mismo entorno."
            align="center"
            inverted
          />
        </FadeIn>

        <Stagger className="mt-12 grid gap-5 md:grid-cols-2">
          {flows.map((flow) => (
            <StaggerItem key={flow.title}>
              <article className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
                <flow.icon className="h-6 w-6 text-pragma-cyan" strokeWidth={1.75} />
                <h3 className="mt-4 font-heading text-lg font-semibold">{flow.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/70">
                  {flow.description}
                </p>
              </article>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
