"use client";

import {
  CalendarDays,
  ClipboardList,
  MessageCircle,
  RefreshCw,
  Settings2,
  Zap,
} from "lucide-react";
import { FadeIn, Stagger, StaggerItem } from "@/components/landing/motion";
import { SectionHeading } from "@/components/landing/section-heading";

const features = [
  {
    icon: CalendarDays,
    title: "Calendario inteligente",
    description:
      "Disponibilidad multi-propiedad con bloqueos, estancias y sincronización en tiempo real.",
  },
  {
    icon: MessageCircle,
    title: "Bandeja unificada",
    description:
      "Mensajes de huéspedes con contexto de reserva. Sin cambiar de pestaña.",
  },
  {
    icon: RefreshCw,
    title: "Integraciones",
    description:
      "Airbnb, iCal y canales conectados para mantener tu operación alineada.",
  },
  {
    icon: Settings2,
    title: "Gestión operativa",
    description:
      "Panel de control, tareas y visibilidad para equipos que escalan.",
  },
  {
    icon: ClipboardList,
    title: "Reservas",
    description:
      "Estados claros, filtros y flujo de trabajo desde confirmación a checkout.",
  },
  {
    icon: Zap,
    title: "Sincronización",
    description:
      "Importación automática y reglas que reducen errores operativos manuales.",
  },
];

export function LandingFeatures() {
  return (
    <section id="features" className="border-t border-[#E9ECEF] bg-[#F7F8FA] py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <FadeIn>
          <SectionHeading
            eyebrow="Funciones"
            title="Todo lo que tu equipo necesita para operar con precisión"
            description="Una plataforma cohesiva para propietarios y operadores de renta corta en Colombia."
            align="center"
          />
        </FadeIn>

        <Stagger className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <StaggerItem key={feature.title}>
              <article className="group h-full rounded-2xl border border-[#E9ECEF] bg-white p-8 shadow-pragma-soft transition-all duration-300 hover:-translate-y-0.5 hover:shadow-pragma-card">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#E6F7F5] text-[#0E9F8D] transition-colors group-hover:bg-[#0E9F8D] group-hover:text-white">
                  <feature.icon className="h-6 w-6" strokeWidth={1.5} />
                </div>
                <h3 className="mt-6 text-lg font-semibold text-[#111111]">
                  {feature.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-[#6B7280]">
                  {feature.description}
                </p>
              </article>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
