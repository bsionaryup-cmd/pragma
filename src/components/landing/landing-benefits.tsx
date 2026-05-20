"use client";

import {
  BarChart3,
  Layers,
  ShieldCheck,
  TrendingUp,
  Workflow,
} from "lucide-react";
import { FadeIn } from "@/components/landing/motion";
import { LandingCalendarMockup } from "@/components/landing/landing-calendar-mockup";

const benefits = [
  {
    icon: ShieldCheck,
    title: "Menos errores operativos",
    description:
      "Un solo lugar para reservas, mensajes y calendario reduce duplicados y olvidos.",
  },
  {
    icon: Layers,
    title: "Centralización total",
    description:
      "Airbnb, directo e integraciones conectados sin saltar entre herramientas.",
  },
  {
    icon: TrendingUp,
    title: "Escalabilidad real",
    description:
      "Crece de 5 a 50 unidades sin perder visibilidad ni control del equipo.",
  },
  {
    icon: BarChart3,
    title: "Mejor control",
    description:
      "Métricas de ocupación y operación diaria para decisiones informadas.",
  },
  {
    icon: Workflow,
    title: "Flujo de trabajo claro",
    description:
      "Desde el primer mensaje hasta el checkout, cada paso tiene su lugar.",
  },
];

export function LandingBenefits() {
  return (
    <section id="benefits" className="border-t border-[#E9ECEF] bg-white py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <FadeIn>
          <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-[#0E9F8D]">
            Beneficios
          </p>
          <h2 className="mx-auto mt-3 max-w-2xl text-center text-3xl font-bold tracking-tight text-[#111111] md:text-4xl">
            Diseñado para equipos que no pueden permitirse el caos
          </h2>
        </FadeIn>

        <div className="mt-20 space-y-24">
          {benefits.map((benefit, index) => {
            const reversed = index % 2 === 1;
            const Icon = benefit.icon;

            return (
              <FadeIn key={benefit.title} delay={index * 0.05}>
                <div
                  className={`grid items-center gap-12 lg:grid-cols-2 lg:gap-20 ${
                    reversed ? "lg:[&>*:first-child]:order-2" : ""
                  }`}
                >
                  <div className={reversed ? "lg:order-2" : ""}>
                    <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#E6F7F5] text-[#0E9F8D]">
                      <Icon className="h-6 w-6" strokeWidth={1.5} />
                    </div>
                    <h3 className="text-2xl font-semibold text-[#111111]">
                      {benefit.title}
                    </h3>
                    <p className="mt-4 text-base leading-relaxed text-[#6B7280]">
                      {benefit.description}
                    </p>
                  </div>

                  <div
                    className={`overflow-hidden rounded-2xl border border-[#E9ECEF] bg-[#F7F8FA] p-6 shadow-pragma-soft ${
                      reversed ? "lg:order-1" : ""
                    }`}
                  >
                    {index === 0 ? (
                      <LandingCalendarMockup />
                    ) : (
                      <div className="flex aspect-[4/3] items-center justify-center rounded-xl bg-white">
                        <Icon className="h-16 w-16 text-[#0E9F8D]/20" strokeWidth={1} />
                      </div>
                    )}
                  </div>
                </div>
              </FadeIn>
            );
          })}
        </div>
      </div>
    </section>
  );
}
