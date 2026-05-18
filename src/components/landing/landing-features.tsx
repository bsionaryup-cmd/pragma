"use client";

import {
  CalendarDays,
  ClipboardList,
  MessageCircle,
  Shield,
  Zap,
} from "lucide-react";
import { FadeIn, Stagger, StaggerItem } from "@/components/landing/motion";
import { SectionHeading } from "@/components/landing/section-heading";

const features = [
  {
    icon: ClipboardList,
    title: "Reservas centralizadas",
    description:
      "Todas tus reservas de Airbnb y canales directos en una sola vista, con estados y filtros claros.",
  },
  {
    icon: MessageCircle,
    title: "Comunicación unificada",
    description:
      "Responde huéspedes sin cambiar de pestaña. Historial, contexto y reserva al lado.",
  },
  {
    icon: CalendarDays,
    title: "Calendario multi-propiedad",
    description:
      "Disponibilidad visual por unidad. Bloqueos, estancias y sincronización en tiempo real.",
  },
  {
    icon: Zap,
    title: "Automatización inteligente",
    description:
      "Importación Airbnb, iCal y reglas que reducen trabajo manual en operaciones diarias.",
  },
  {
    icon: Shield,
    title: "Roles y permisos",
    description:
      "Administra quién ve qué. Equipos de operaciones con acceso granular y seguro.",
  },
  {
    icon: CalendarDays,
    title: "Hecho para Colombia",
    description:
      "Moneda COP, zona horaria Bogotá y flujos pensados para renta corta local.",
  },
];

export function LandingFeatures() {
  return (
    <section id="features" className="border-t border-white/5 py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <FadeIn>
          <SectionHeading
            eyebrow="Funciones"
            title="Todo lo que tu equipo necesita, nada que no"
            description="Una plataforma cohesiva para propietarios y operadores que gestionan decenas de unidades sin perder el control."
          />
        </FadeIn>

        <Stagger className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <StaggerItem key={feature.title}>
              <article className="group h-full rounded-2xl border border-white/5 bg-zinc-900/40 p-6 transition-colors hover:border-white/10 hover:bg-zinc-900/60">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-300 transition-colors group-hover:border-violet-500/30 group-hover:text-violet-300">
                  <feature.icon className="h-5 w-5" strokeWidth={1.5} />
                </div>
                <h3 className="mt-5 text-base font-medium text-zinc-50">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
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

