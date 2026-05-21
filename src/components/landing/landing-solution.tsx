"use client";

import {
  Bell,
  Building2,
  KeyRound,
  Link2,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import { FadeIn, Stagger, StaggerItem } from "@/components/landing/motion";
import { SectionHeading } from "@/components/landing/section-heading";

const blocks = [
  {
    icon: Building2,
    title: "Reservas centralizadas",
    description: "Un solo flujo para confirmaciones, huéspedes y operación diaria.",
  },
  {
    icon: KeyRound,
    title: "Smart Access",
    description: "TTLock y accesos remotos listos para automatizar check-in.",
  },
  {
    icon: TrendingUp,
    title: "Pricing Automation",
    description: "Sugerencias y reglas para optimizar ingresos sin hojas sueltas.",
  },
  {
    icon: Building2,
    title: "Multi-property control",
    description: "Portafolio completo con visibilidad por unidad y alertas.",
  },
  {
    icon: Link2,
    title: "Integraciones",
    description: "Airbnb, iCal, smart locks y herramientas de tu stack.",
  },
  {
    icon: Bell,
    title: "Alertas",
    description: "Prioridades claras: llegadas, sync, accesos y excepciones.",
  },
  {
    icon: Sparkles,
    title: "Recomendaciones IA",
    description: "Copiloto que sugiere próximos pasos según tu operación.",
  },
  {
    icon: Zap,
    title: "Automatización",
    description: "Workflows que reducen tareas repetitivas del anfitrión.",
  },
];

export function LandingSolution() {
  return (
    <section id="solution" className="border-t border-pragma-border bg-white py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <FadeIn>
          <SectionHeading
            eyebrow="La solución"
            title="Un copiloto inteligente para anfitriones modernos."
            description="PRAGMA es Airbnb-first: diseñado para hosts que escalan, no para hospitality hotelero genérico."
            align="center"
          />
        </FadeIn>

        <Stagger className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {blocks.map((block) => (
            <StaggerItem key={block.title}>
              <article className="group h-full rounded-2xl border border-pragma-border bg-white p-6 shadow-pragma-soft transition-all duration-300 hover:-translate-y-0.5 hover:border-pragma-cyan/40 hover:shadow-pragma-card">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-pragma-soft-cyan text-pragma-electric transition-colors group-hover:bg-pragma-gradient group-hover:text-white">
                  <block.icon className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <h3 className="mt-5 font-heading text-base font-semibold text-pragma-black">
                  {block.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-pragma-mid-gray">
                  {block.description}
                </p>
              </article>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
