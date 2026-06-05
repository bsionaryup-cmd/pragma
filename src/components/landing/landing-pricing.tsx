"use client";

import { motion } from "framer-motion";
import { Check, Sparkles } from "lucide-react";
import { CommercialContactButton } from "@/components/landing/commercial-contact-button";
import {
  LANDING_COMMERCIAL_CTAS,
  PLAN_COMMERCIAL_CTA,
} from "@/lib/landing-commercial";
import { PLAN_CATALOG } from "@/modules/billing/domain/plan-catalog";
import { FadeIn } from "@/components/landing/motion";

export function LandingPricing() {
  const plans = Object.values(PLAN_CATALOG);

  return (
    <section id="pricing" className="border-t border-pragma-border bg-white py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-6">
        <FadeIn>
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-accent text-xs font-semibold uppercase tracking-[0.18em] text-pragma-electric">
              Planes
            </p>
            <h2 className="font-heading mt-3 text-2xl font-bold tracking-tight text-pragma-black md:text-3xl">
              Starter, Pro y Scale para cada etapa de tu operación
            </h2>
            <p className="mt-3 text-base text-pragma-mid-gray">
              Compara beneficios y elige el plan que mejor se adapte a tu portafolio. Un asesor
              comercial te acompaña con una propuesta a la medida.
            </p>
          </div>
        </FadeIn>

        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3 lg:items-stretch">
          {plans.map((plan, index) => {
            const isPro = plan.code === "PRO";
            const isScale = plan.code === "SCALE";

            return (
              <FadeIn key={plan.code} delay={index * 0.06}>
                <motion.div
                  whileHover={{ y: isPro ? -6 : -4 }}
                  className={`relative flex h-full flex-col overflow-hidden rounded-3xl border bg-white shadow-pragma-card ${
                    plan.highlighted
                      ? "z-10 scale-[1.02] border-pragma-cyan ring-2 ring-pragma-cyan/25 lg:py-2"
                      : "border-pragma-border"
                  }`}
                >
                  {plan.badge ? (
                    <div className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-pragma-electric px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                      <Sparkles className="h-3.5 w-3.5" />
                      {plan.badge}
                    </div>
                  ) : null}

                  <div
                    className={`px-8 py-6 ${plan.highlighted ? "bg-pragma-light-blue/50" : "bg-pragma-soft-gray/50"}`}
                  >
                    <p className="text-sm font-semibold uppercase tracking-wide text-pragma-electric">
                      {plan.name}
                    </p>
                    <p className="mt-1 text-sm text-pragma-mid-gray">{plan.tagline}</p>
                    {isPro ? (
                      <p className="mt-4 text-sm font-medium text-pragma-electric/90">
                        Recomendado · TTLock, PriceLabs y finanzas incluidos.
                      </p>
                    ) : null}
                    {isScale ? (
                      <p className="mt-4 text-sm text-pragma-mid-gray">
                        Volumen alto, soporte prioritario y consola comercial.
                      </p>
                    ) : null}
                    <p className="mt-3 text-sm text-pragma-mid-gray">{plan.description}</p>
                  </div>
                  <ul className="flex-1 space-y-3 px-8 py-6">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-3 text-sm">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-pragma-cyan" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto border-t px-8 py-6">
                    <CommercialContactButton
                      label={PLAN_COMMERCIAL_CTA[plan.code]}
                      className="w-full"
                    />
                  </div>
                </motion.div>
              </FadeIn>
            );
          })}
        </div>

        <FadeIn delay={0.2}>
          <div className="mx-auto mt-12 max-w-3xl text-center">
            <p className="text-sm text-pragma-mid-gray">
              ¿Quieres conocer PRAGMA antes de decidir? Escríbenos por WhatsApp y te ayudamos a
              elegir el plan ideal.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {LANDING_COMMERCIAL_CTAS.map((cta) => (
                <CommercialContactButton
                  key={cta}
                  label={cta}
                  size="sm"
                  variant={cta === "Hablar con un asesor" ? "primary" : "outline"}
                />
              ))}
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
