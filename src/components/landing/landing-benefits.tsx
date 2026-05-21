"use client";

import {
  Eye,
  Gauge,
  MapPin,
  Sparkles,
  Workflow,
  Zap,
} from "lucide-react";
import { FadeIn, Stagger, StaggerItem } from "@/components/landing/motion";
import { SectionHeading } from "@/components/landing/section-heading";

const benefits = [
  {
    icon: Zap,
    title: "Menos tareas manuales",
    description: "Automatiza sync, alertas y flujos operativos del día a día.",
  },
  {
    icon: MapPin,
    title: "Más control remoto",
    description: "Gestiona propiedades, accesos y reservas desde cualquier lugar.",
  },
  {
    icon: Gauge,
    title: "Mejor productividad",
    description: "Un Command Center que prioriza lo urgente para tu equipo.",
  },
  {
    icon: Sparkles,
    title: "Escala sin caos",
    description: "Multi-property sin perder visibilidad ni calidad de servicio.",
  },
  {
    icon: Workflow,
    title: "Operación centralizada",
    description: "Reservas, calendario, mensajes e integraciones en un solo lugar.",
  },
  {
    icon: Eye,
    title: "Mejor visibilidad",
    description: "KPIs, ocupación y health score operativo en tiempo real.",
  },
];

export function LandingBenefits() {
  return (
    <section id="benefits" className="border-t border-pragma-border bg-pragma-soft-gray py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <FadeIn>
          <SectionHeading
            eyebrow="Beneficios"
            title="Opera Airbnb con claridad, velocidad y control total."
            description="PRAGMA está pensado para anfitriones que quieren crecer sin multiplicar el estrés operativo."
            align="center"
          />
        </FadeIn>

        <Stagger className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((benefit) => (
            <StaggerItem key={benefit.title}>
              <article className="h-full rounded-2xl border border-pragma-border bg-white p-6 shadow-pragma-soft">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-pragma-soft-cyan text-pragma-electric">
                  <benefit.icon className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <h3 className="mt-5 font-heading text-lg font-semibold text-pragma-black">
                  {benefit.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-pragma-mid-gray">
                  {benefit.description}
                </p>
              </article>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
