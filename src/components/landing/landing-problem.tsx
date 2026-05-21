"use client";

import {
  CalendarDays,
  KeyRound,
  MessageSquare,
  Sparkles,
  SprayCan,
  Wallet,
} from "lucide-react";
import { FadeIn, Stagger, StaggerItem } from "@/components/landing/motion";
import { SectionHeading } from "@/components/landing/section-heading";

const pains = [
  { icon: CalendarDays, label: "Reservas en varias apps" },
  { icon: Wallet, label: "Pricing manual" },
  { icon: KeyRound, label: "Accesos desconectados" },
  { icon: MessageSquare, label: "Mensajes dispersos" },
  { icon: SprayCan, label: "Limpieza sin visibilidad" },
  { icon: Sparkles, label: "Estrés operativo" },
];

export function LandingProblem() {
  return (
    <section id="problem" className="border-t border-pragma-border bg-pragma-soft-gray py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <FadeIn>
          <SectionHeading
            eyebrow="El problema"
            title="Gestionar Airbnb no debería sentirse como manejar cinco herramientas al mismo tiempo."
            description="Anfitriones modernos pierden tiempo saltando entre calendarios, mensajes, accesos y hojas de cálculo. PRAGMA elimina esa fricción."
            align="center"
          />
        </FadeIn>

        <Stagger className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pains.map((item) => (
            <StaggerItem key={item.label}>
              <article className="flex items-center gap-4 rounded-2xl border border-pragma-border bg-white p-5 shadow-pragma-soft">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-pragma-light-blue text-pragma-electric">
                  <item.icon className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <p className="text-sm font-medium text-pragma-black">{item.label}</p>
              </article>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
