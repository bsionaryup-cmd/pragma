"use client";

import { BarChart3, CheckSquare, LayoutGrid } from "lucide-react";
import { FadeIn, Stagger, StaggerItem } from "@/components/landing/motion";
import { SectionHeading } from "@/components/landing/section-heading";

const ops = [
  {
    icon: LayoutGrid,
    title: "Panel de control",
    description:
      "Llegadas, salidas y huéspedes alojados en un vistazo. Actúa antes de que surja un problema.",
    metric: "16 llegadas",
  },
  {
    icon: BarChart3,
    title: "Visibilidad operativa",
    description:
      "Métricas de ocupación y rendimiento por propiedad para decisiones basadas en datos.",
    metric: "84% ocupación",
  },
  {
    icon: CheckSquare,
    title: "Tareas coordinadas",
    description:
      "Limpieza, mantenimiento y check-in asignados al equipo con seguimiento claro.",
    metric: "8 pendientes",
  },
];

export function LandingOperations() {
  return (
    <section id="operations" className="border-t border-border py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <FadeIn>
          <SectionHeading
            eyebrow="Operaciones inteligentes"
            title="Tu equipo siempre un paso adelante"
            description="Desde el primer mensaje hasta el check-out, PRAGMA conecta cada pieza del puzzle operativo."
          />
        </FadeIn>

        <Stagger className="mt-16 grid gap-6 lg:grid-cols-3">
          {ops.map((item) => (
            <StaggerItem key={item.title}>
              <article className="relative h-full overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-card/80 to-background/80 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface-alt/50">
                    <item.icon className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
                  </div>
                  <span className="rounded-full border border-border bg-surface-alt/50 px-2.5 py-1 text-xs text-muted-foreground">
                    {item.metric}
                  </span>
                </div>
                <h3 className="mt-6 text-lg font-medium text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
                <div className="pointer-events-none absolute -right-8 -bottom-8 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />
              </article>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
