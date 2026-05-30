"use client";

import { FadeIn } from "@/components/landing/motion";
import { LandingDashboardMockup } from "@/components/landing/landing-dashboard-mockup";
import { SectionHeading } from "@/components/landing/section-heading";

export function LandingShowcase() {
  return (
    <section
      id="product"
      className="border-t border-white/10 bg-pragma-gradient-premium-dark py-20 text-white md:py-28"
    >
      <div className="mx-auto max-w-7xl px-6">
        <FadeIn>
          <SectionHeading
            eyebrow="Dashboard"
            title="Panel operativo de PRAGMA."
            description="Reservas, calendario, finanzas, accesos y tarifas en una interfaz modular lista para escalar."
            align="center"
          />
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="relative mt-14 overflow-hidden rounded-3xl border border-white/15 bg-white/5 p-4 shadow-pragma-card backdrop-blur-sm md:p-8">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-pragma-gradient opacity-20 blur-3xl"
            />
            <LandingDashboardMockup />
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
