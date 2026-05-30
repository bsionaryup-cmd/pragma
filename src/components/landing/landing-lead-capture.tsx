"use client";

import { FadeIn } from "@/components/landing/motion";
import { CommercialContactButton } from "@/components/landing/commercial-contact-button";
import { LeadCaptureForm } from "@/features/leads/components/lead-capture-form";

export function LandingLeadCapture() {
  return (
    <section id="contact" className="border-t border-pragma-border py-16 md:py-20">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-2 lg:items-start">
        <FadeIn>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-pragma-electric">
            Contacto
          </p>
          <h2 className="font-heading mt-3 text-2xl font-bold tracking-tight md:text-3xl">
            Habla con un experto de PRAGMA
          </h2>
          <p className="mt-3 text-pragma-mid-gray">
            Cuéntanos tu operación y te ayudamos a evaluar el plan adecuado. También puedes
            activar la prueba gratis cuando prefieras usar el software directamente.
          </p>
          <CommercialContactButton
            label="Agendar una llamada"
            className="mt-6"
            variant="outline"
          />
        </FadeIn>
        <FadeIn delay={0.08}>
          <div className="rounded-2xl border border-pragma-border bg-white p-6 shadow-pragma-card">
            <LeadCaptureForm source="landing-contact" />
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
