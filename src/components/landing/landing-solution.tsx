"use client";

import {
  Bell,
  Building2,
  CalendarDays,
  KeyRound,
  Link2,
  Receipt,
  TrendingUp,
} from "lucide-react";
import { FadeIn, Stagger, StaggerItem } from "@/components/landing/motion";
import { SectionHeading } from "@/components/landing/section-heading";

const blocks = [
  {
    icon: Building2,
    title: "Reservas centralizadas",
    description: "Inbox operativo, huéspedes y estados en un solo flujo.",
  },
  {
    icon: CalendarDays,
    title: "Calendario multi-propiedad",
    description: "Disponibilidad, bloqueos y reservas por unidad.",
  },
  {
    icon: KeyRound,
    title: "Smart Access (TTLock)",
    description: "Códigos y accesos vinculados a cada reserva.",
  },
  {
    icon: TrendingUp,
    title: "Tarifas (PriceLabs)",
    description: "Sync de precios, overrides y vista operativa diaria.",
  },
  {
    icon: Receipt,
    title: "Finanzas operativas",
    description: "Ingresos, egresos manuales, cobros y reportes del mes.",
  },
  {
    icon: Link2,
    title: "Integraciones",
    description: "Airbnb iCal, TTLock, PriceLabs y Wompi por organización.",
  },
  {
    icon: Bell,
    title: "Tareas y alertas",
    description: "Checklists operativos ligados a propiedades y reservas.",
  },
];

export function LandingSolution() {
  return (
    <section id="solution" className="border-t border-pragma-border bg-white py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-6">
        <FadeIn>
          <SectionHeading
            eyebrow="La solución"
            title="Un panel para operar alojamientos con claridad."
            description="PRAGMA concentra lo que ya existe en el producto: reservas, calendario, accesos, tarifas y finanzas."
            align="center"
          />
        </FadeIn>

        <Stagger className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
