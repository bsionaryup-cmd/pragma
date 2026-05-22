"use client";

import Link from "next/link";
import { FadeIn } from "@/components/landing/motion";
import { LeadCaptureForm } from "@/features/leads/components/lead-capture-form";
import { getLandingPrimaryCta, type LandingSession } from "@/lib/landing-session";
import { Button } from "@/components/ui/button";

type LandingLeadCaptureProps = {
  session: LandingSession;
};

export function LandingLeadCapture({ session }: LandingLeadCaptureProps) {
  const primary = getLandingPrimaryCta(session);

  return (
    <section id="contact" className="border-t border-pragma-border py-20 md:py-24">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-2 lg:items-start">
        <FadeIn>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-pragma-electric">
            Contacto
          </p>
          <h2 className="font-heading mt-3 text-3xl font-bold tracking-tight">
            ¿Prefieres que te contactemos?
          </h2>
          <p className="mt-4 text-pragma-mid-gray">
            Déjanos tus datos y un especialista te ayudará a evaluar PRAGMA. También puedes
            activar la prueba gratis cuando quieras usar el software.
          </p>
          <Button variant="brandOutline" className="mt-6" asChild>
            <Link href={primary.href}>{primary.label}</Link>
          </Button>
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
