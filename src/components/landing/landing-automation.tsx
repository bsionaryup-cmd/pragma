"use client";

import { Bot, GitBranch, Timer, Wand2 } from "lucide-react";
import { FadeIn } from "@/components/landing/motion";
import { SectionHeading } from "@/components/landing/section-heading";

const flows = [
  {
    icon: GitBranch,
    title: "Workflows operativos",
    description: "Reglas que conectan reservas, accesos y tareas sin intervención manual.",
  },
  {
    icon: Timer,
    title: "Tareas en piloto automático",
    description: "Check-in, limpieza y recordatorios según el ciclo de cada reserva.",
  },
  {
    icon: Wand2,
    title: "IA nativa",
    description: "Sugerencias contextuales para pricing, ocupación y prioridades del día.",
  },
  {
    icon: Bot,
    title: "Copiloto del anfitrión",
    description: "Menos fricción, más claridad: PRAGMA piensa en operaciones, tú en crecer.",
  },
];

export function LandingAutomation() {
  return (
    <section id="automation" className="border-t border-pragma-border bg-pragma-navy py-20 text-white md:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <FadeIn>
          <SectionHeading
            eyebrow="Automatización"
            title="IA + workflows para anfitriones que escalan."
            description="Automatiza lo repetitivo. Mantén control total sobre lo que importa: huéspedes, ingresos y accesos."
            align="center"
            inverted
          />
        </FadeIn>

        <div className="mt-14 grid gap-5 md:grid-cols-2">
          {flows.map((flow) => (
            <article
              key={flow.title}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm"
            >
              <flow.icon className="h-6 w-6 text-pragma-cyan" strokeWidth={1.75} />
              <h3 className="mt-4 font-heading text-lg font-semibold">{flow.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/70">
                {flow.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
