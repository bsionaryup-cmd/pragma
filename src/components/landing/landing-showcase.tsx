"use client";

import { FadeIn } from "@/components/landing/motion";
import { LandingDashboardMockup } from "@/components/landing/landing-dashboard-mockup";
import { SectionHeading } from "@/components/landing/section-heading";

export function LandingShowcase() {
  return (
    <section id="product" className="border-t border-pragma-border bg-white py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <FadeIn>
          <SectionHeading
            eyebrow="Dashboard"
            title="Tu Airbnb Host Command Center."
            description="Overview, reservas, smart access, pricing y automatización en una interfaz modular, limpia y lista para escalar."
            align="center"
          />
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="relative mt-14 overflow-hidden rounded-3xl border border-pragma-border bg-pragma-gradient-subtle p-4 shadow-pragma-glow md:p-8">
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
