"use client";

import { motion } from "framer-motion";
import { AuthCtaPair } from "@/components/brand/auth-cta-buttons";
import { SUBSCRIPTION_TRIAL_LABEL } from "@/lib/constants";
import type { LandingSession } from "@/lib/landing-session";
import { FadeIn } from "@/components/landing/motion";

type LandingCtaProps = {
  session: LandingSession;
};

export function LandingCta({ session }: LandingCtaProps) {
  return (
    <section className="border-t border-pragma-border bg-pragma-soft-gray py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <FadeIn>
          <motion.div
            whileHover={{ scale: 1.005 }}
            transition={{ duration: 0.3 }}
            className="relative overflow-hidden rounded-3xl border border-pragma-border bg-white px-8 py-16 text-center shadow-pragma-card md:px-16 md:py-20"
          >
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,#14E4C820,transparent_60%)]"
              aria-hidden
            />
            <div className="relative">
              <h2 className="font-heading text-3xl font-bold tracking-tight text-pragma-black md:text-4xl">
                Gestiona mejor. Automatiza más. Escala sin fricción.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-base text-pragma-mid-gray">
                {session.signedIn && session.needsTrialSetup
                  ? "Configura tu prueba gratis y usa PRAGMA con tu operación real."
                  : "Centraliza reservas, calendario e ingresos en un Command Center inteligente."}
              </p>
              <div className="mt-10 flex flex-col items-center">
                <AuthCtaPair session={session} size="lg" layout="column" className="items-center" />
              </div>
              <p className="mt-6 text-xs text-pragma-mid-gray">
                {SUBSCRIPTION_TRIAL_LABEL} · Sin tarjeta para empezar
              </p>
            </div>
          </motion.div>
        </FadeIn>
      </div>
    </section>
  );
}
