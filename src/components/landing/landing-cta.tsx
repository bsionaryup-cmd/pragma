"use client";

import { motion } from "framer-motion";
import { CommercialContactButton } from "@/components/landing/commercial-contact-button";
import { SUBSCRIPTION_TRIAL_LABEL } from "@/lib/constants";
import { FadeIn } from "@/components/landing/motion";

export function LandingCta() {
  return (
    <section className="border-t border-pragma-border bg-pragma-soft-gray py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-6">
        <FadeIn>
          <motion.div
            whileHover={{ scale: 1.005 }}
            transition={{ duration: 0.3 }}
            className="relative overflow-hidden rounded-3xl border border-pragma-border bg-white px-8 py-14 text-center shadow-pragma-card md:px-16 md:py-16"
          >
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,#14E4C820,transparent_60%)]"
              aria-hidden
            />
            <div className="relative">
              <h2 className="font-heading text-2xl font-bold tracking-tight text-pragma-black md:text-3xl">
                ¿Listo para ver PRAGMA en acción?
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-base text-pragma-mid-gray">
                Agenda una demo guiada o habla con un especialista. Te mostramos calendario,
                reservas y finanzas con tu operación real en mente.
              </p>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <CommercialContactButton label="Solicitar demo" size="lg" />
                <CommercialContactButton
                  label="Contactar asesor"
                  size="lg"
                  variant="outline"
                />
              </div>
              <p className="mt-5 text-xs text-pragma-mid-gray">
                {SUBSCRIPTION_TRIAL_LABEL} · Inicia sesión desde el header cuando quieras probar
              </p>
            </div>
          </motion.div>
        </FadeIn>
      </div>
    </section>
  );
}
