"use client";

import { FadeIn } from "@/components/landing/motion";
import { LandingCalendarMockup } from "@/components/landing/landing-calendar-mockup";
import { SectionHeading } from "@/components/landing/section-heading";

export function LandingShowcase() {
  return (
    <section id="product" className="py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <FadeIn>
          <SectionHeading
            eyebrow="Producto"
            title="Un calendario operativo que tu equipo entiende al instante"
            description="Visualiza ocupación, reservas y bloqueos en un workspace diseñado para decisiones rápidas."
            align="center"
          />
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="relative mt-16 overflow-hidden rounded-3xl border border-[#E9ECEF] bg-[#F7F8FA] p-4 shadow-pragma-card md:p-8">
            <LandingCalendarMockup className="w-full" />
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
