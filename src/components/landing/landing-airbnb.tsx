"use client";

import { RefreshCw, Link2, Download } from "lucide-react";
import { FadeIn } from "@/components/landing/motion";
import { SectionHeading } from "@/components/landing/section-heading";

const steps = [
  {
    icon: Link2,
    title: "Conecta Airbnb",
    description: "Importa listados y reservas con un flujo guiado.",
  },
  {
    icon: RefreshCw,
    title: "Sincronización continua",
    description: "Calendarios y disponibilidad actualizados automáticamente.",
  },
  {
    icon: Download,
    title: "Exporta iCal",
    description: "Comparte disponibilidad con otros canales sin fricción.",
  },
];

export function LandingAirbnb() {
  return (
    <section id="airbnb" className="border-t border-border py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid items-center gap-16 lg:grid-cols-2">
          <FadeIn>
            <SectionHeading
              eyebrow="Automatización Airbnb"
              title="Menos copiar y pegar, más tiempo para crecer"
              description="PRAGMA sincroniza tus propiedades Airbnb, importa reservas y mantiene calendarios alineados para que tu equipo opere con datos confiables."
            />

            <ul className="mt-10 space-y-6">
              {steps.map((step) => (
                <li key={step.title} className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-alt/50">
                    <step.icon className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{step.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </FadeIn>

          <FadeIn delay={0.15}>
            <div className="relative">
              <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-[#FF5A5F]/20 to-transparent blur-2xl" />
              <div className="relative overflow-hidden rounded-2xl border border-border bg-card/60 p-6">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">
                    Sincronización activa
                  </span>
                  <span className="flex items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-1 text-xs text-success">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
                    En vivo
                  </span>
                </div>
                <div className="space-y-3">
                  {[
                    "Apto 101 — Laureles",
                    "Apto 302 — Poblado",
                    "Casa Campestre — Rionegro",
                  ].map((name) => (
                    <div
                      key={name}
                      className="flex items-center justify-between rounded-xl border border-border bg-background/50 px-4 py-3"
                    >
                      <span className="text-sm text-muted-foreground">{name}</span>
                      <RefreshCw className="h-4 w-4 text-text-subtle" />
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-center text-xs text-text-subtle">
                  Última sync: hace 2 min
                </p>
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}

