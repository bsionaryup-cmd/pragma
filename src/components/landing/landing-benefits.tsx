"use client";

import { CalendarDays, Eye, Receipt, TrendingUp, Wallet } from "lucide-react";
import { FadeIn, Stagger, StaggerItem } from "@/components/landing/motion";
import { SectionHeading } from "@/components/landing/section-heading";

const benefits = [
  {
    icon: CalendarDays,
    title: "Calendario unificado",
    description: "Disponibilidad y reservas visibles por propiedad.",
  },
  {
    icon: TrendingUp,
    title: "Reservas bajo control",
    description: "Estados, huéspedes y detalle operativo en un inbox.",
  },
  {
    icon: Wallet,
    title: "Finanzas del mes",
    description: "Ingresos, egresos y balance sin hojas externas.",
  },
  {
    icon: Receipt,
    title: "Cobros con Wompi",
    description: "Links de pago y reconciliación por organización.",
  },
  {
    icon: Eye,
    title: "Visibilidad del portafolio",
    description: "KPIs y métricas en el dashboard principal.",
  },
];

export function LandingBenefits() {
  return (
    <section id="benefits" className="border-t border-pragma-border bg-pragma-soft-gray py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-6">
        <FadeIn>
          <SectionHeading
            eyebrow="Beneficios"
            title="Menos fricción, más control operativo."
            description="Funcionalidades reales del producto, pensadas para anfitriones y operadores en Colombia."
            align="center"
          />
        </FadeIn>

        <Stagger className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((benefit) => (
            <StaggerItem key={benefit.title}>
              <article className="h-full rounded-2xl border border-pragma-border bg-white p-6 shadow-pragma-soft">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-pragma-soft-cyan text-pragma-electric">
                  <benefit.icon className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <h3 className="mt-5 font-heading text-base font-semibold text-pragma-black">
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
