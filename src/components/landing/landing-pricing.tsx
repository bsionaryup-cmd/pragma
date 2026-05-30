"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, Sparkles } from "lucide-react";
import {
  APP_PRICING_HEADLINE,
  SUBSCRIPTION_TRIAL_LABEL,
} from "@/lib/constants";
import { CommercialContactButton } from "@/components/landing/commercial-contact-button";
import {
  calculateSubscriptionAmount,
  clampPropertyCount,
  formatCop,
  PLAN_CATALOG,
} from "@/modules/billing/domain/plan-catalog";
import { FadeIn } from "@/components/landing/motion";
import { Button } from "@/components/ui/button";

export function LandingPricing() {
  const plans = Object.values(PLAN_CATALOG);
  const [propertyCount, setPropertyCount] = useState(3);

  const count = clampPropertyCount(propertyCount);
  const proPlan = useMemo(() => PLAN_CATALOG.PRO, []);

  return (
    <section id="pricing" className="border-t border-pragma-border bg-white py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-6">
        <FadeIn>
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-accent text-xs font-semibold uppercase tracking-[0.18em] text-pragma-electric">
              Precios
            </p>
            <h2 className="font-heading mt-3 text-2xl font-bold tracking-tight text-pragma-black md:text-3xl">
              {APP_PRICING_HEADLINE}
            </h2>
            <p className="mt-3 text-base text-pragma-mid-gray">
              {SUBSCRIPTION_TRIAL_LABEL}. Paga por propiedad activa — sin paquetes rígidos.
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={0.04}>
          <div className="mx-auto mt-8 max-w-xl rounded-2xl border border-pragma-border bg-pragma-soft-gray/40 p-5">
            <p className="text-center text-sm font-medium text-pragma-black">
              Simula tu inversión mensual
            </p>
            <div className="mt-4 flex items-center justify-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={count <= 1}
                onClick={() => setPropertyCount((c) => clampPropertyCount(c - 1))}
              >
                −
              </Button>
              <span className="min-w-[6rem] text-center text-2xl font-bold tabular-nums">
                {count}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={count >= 99}
                onClick={() => setPropertyCount((c) => clampPropertyCount(c + 1))}
              >
                +
              </Button>
              <span className="text-sm text-pragma-mid-gray">
                propiedad{count === 1 ? "" : "es"}
              </span>
            </div>
          </div>
        </FadeIn>

        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3 lg:items-center">
          {plans.map((plan, index) => {
            const total = calculateSubscriptionAmount(plan.code, count);
            const isPro = plan.code === "PRO";
            const isScale = plan.code === "SCALE";

            return (
              <FadeIn key={plan.code} delay={index * 0.06}>
                <motion.div
                  whileHover={{ y: isPro ? -6 : -4 }}
                  className={`relative overflow-hidden rounded-3xl border bg-white shadow-pragma-card ${
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
                    <p className="font-heading mt-4 text-3xl font-bold tabular-nums md:text-4xl">
                      {formatCop(plan.pricePerPropertyCop)}
                    </p>
                    <p className="mt-1 text-sm text-pragma-mid-gray">por unidad / mes</p>
                    <p className="mt-3 text-base font-semibold text-pragma-black tabular-nums">
                      {formatCop(total)}/mes · {count}{" "}
                      {count === 1 ? "propiedad" : "propiedades"}
                    </p>
                    {isPro ? (
                      <p className="mt-2 text-sm text-pragma-electric/90">
                        Recomendado · TTLock, PriceLabs y finanzas incluidos.
                      </p>
                    ) : null}
                    {isScale ? (
                      <p className="mt-2 text-sm text-pragma-mid-gray">
                        Volumen alto, soporte prioritario y consola comercial.
                      </p>
                    ) : null}
                    <p className="mt-3 text-sm text-pragma-mid-gray">{plan.description}</p>
                  </div>
                  <ul className="space-y-3 px-8 py-6">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-3 text-sm">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-pragma-cyan" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="border-t px-8 py-6">
                    <CommercialContactButton
                      label={
                        isScale
                          ? "Agendar una llamada"
                          : isPro
                            ? "Solicitar demo del plan Pro"
                            : "Contactar asesor"
                      }
                      className="w-full"
                    />
                  </div>
                </motion.div>
              </FadeIn>
            );
          })}
        </div>

        <p className="mx-auto mt-8 max-w-xl text-center text-xs text-pragma-mid-gray">
          Plan Pro desde {formatCop(proPlan.pricePerPropertyCop)}/unidad — el más elegido por
          operadores en crecimiento.
        </p>
      </div>
    </section>
  );
}
