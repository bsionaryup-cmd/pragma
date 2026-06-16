"use client";

import { FadeIn } from "@/components/landing/motion";
import {
  LANDING_MARKETING_SCREENSHOTS,
  LANDING_SHOWCASE_SCREENSHOT_SIZES,
  LandingProductScreenshot,
} from "@/components/landing/landing-product-screenshot";
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
            eyebrow="Calendario"
            title="Visualiza reservas por propiedad en tiempo real."
            description="Un calendario operativo con estadías, huéspedes y disponibilidad en una sola vista. Sin saltar entre herramientas."
            align="center"
            inverted
          />
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="relative mt-14 overflow-hidden rounded-3xl border border-white/20 bg-white/[0.07] p-4 shadow-pragma-card backdrop-blur-sm md:p-8">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-pragma-gradient opacity-25 blur-3xl"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-pragma-cyan/30 opacity-40 blur-3xl"
            />
            <LandingProductScreenshot
              {...LANDING_MARKETING_SCREENSHOTS.showcase}
              sizes={LANDING_SHOWCASE_SCREENSHOT_SIZES}
            />
          </div>
        </FadeIn>

        <FadeIn delay={0.18}>
          <ul className="mx-auto mt-10 grid max-w-3xl gap-3 text-sm sm:grid-cols-3">
            {[
              "Bloques por huésped y fechas de estadía",
              "Columna fija de propiedades al desplazar",
              "Sincronización con Airbnb e iCal",
            ].map((item) => (
              <li
                key={item}
                className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-center font-medium text-white/90"
              >
                {item}
              </li>
            ))}
          </ul>
        </FadeIn>
      </div>
    </section>
  );
}
