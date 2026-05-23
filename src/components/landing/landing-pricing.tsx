"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, Sparkles } from "lucide-react";
import {
  APP_PRICING_HEADLINE,
  SUBSCRIPTION_TRIAL_LABEL,
} from "@/lib/constants";
import { FreeTrialButton, LogInButton } from "@/components/brand/auth-cta-buttons";
import {
  getLandingPrimaryCta,
  type LandingSession,
} from "@/lib/landing-session";
import {
  calculateSubscriptionAmount,
  clampPropertyCount,
  formatCop,
  PLAN_CATALOG,
  proPlanMonthlySavingsVsStarter,
} from "@/modules/billing/domain/plan-catalog";
import { FadeIn } from "@/components/landing/motion";
import { Button } from "@/components/ui/button";

type LandingPricingProps = {
  session: LandingSession;
};

export function LandingPricing({ session }: LandingPricingProps) {
  const plans = Object.values(PLAN_CATALOG);
  const primary = getLandingPrimaryCta(session);
  const [propertyCount, setPropertyCount] = useState(3);

  const count = clampPropertyCount(propertyCount);
  const proExtra = useMemo(() => proPlanMonthlySavingsVsStarter(count), [count]);

  return (
    <section id="pricing" className="border-t border-pragma-border bg-white py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <FadeIn>
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-accent text-xs font-semibold uppercase tracking-[0.18em] text-pragma-electric">
              Precios
            </p>
            <h2 className="font-heading mt-3 text-3xl font-bold tracking-tight text-pragma-black md:text-4xl">
              {APP_PRICING_HEADLINE}
            </h2>
            <p className="mt-4 text-base text-pragma-mid-gray">
              {SUBSCRIPTION_TRIAL_LABEL}. Elige cuántas propiedades necesitas y paga solo
              por eso — sin paquetes rígidos.
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={0.04}>
          <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-pragma-border bg-pragma-soft-gray/40 p-5">
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

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {plans.map((plan, index) => {
            const total = calculateSubscriptionAmount(plan.code, count);
            const isPro = plan.code === "PRO";

            return (
              <FadeIn key={plan.code} delay={index * 0.06}>
                <motion.div
                  whileHover={{ y: -4 }}
                  className={`relative overflow-hidden rounded-3xl border bg-white shadow-pragma-card ${
                    plan.highlighted
                      ? "border-pragma-cyan ring-2 ring-pragma-cyan/20"
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
                    className={`px-8 py-6 ${plan.highlighted ? "bg-pragma-light-blue/40" : "bg-pragma-soft-gray/50"}`}
                  >
                    <p className="text-sm font-semibold uppercase tracking-wide text-pragma-electric">
                      {plan.name}
                    </p>
                    <p className="mt-1 text-sm text-pragma-mid-gray">{plan.tagline}</p>
                    <p className="font-heading mt-4 text-4xl font-bold tabular-nums">
                      {formatCop(plan.pricePerPropertyCop)}
                    </p>
                    <p className="mt-1 text-sm text-pragma-mid-gray">por propiedad / mes</p>
                    <p className="mt-3 text-lg font-semibold text-pragma-black tabular-nums">
                      {formatCop(total)}/mes con {count}{" "}
                      {count === 1 ? "propiedad" : "propiedades"}
                    </p>
                    {isPro ? (
                      <p className="mt-2 text-sm text-pragma-mid-gray">
                        Solo {formatCop(proExtra)} más que Básico — mejor ROI operativo.
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
                  <div className="space-y-3 border-t px-8 py-6">
                    <FreeTrialButton
                      href={primary.href}
                      label={isPro ? "Probar plan Pro" : primary.label}
                      className="w-full"
                    />
                    <LogInButton className="w-full" />
                  </div>
                </motion.div>
              </FadeIn>
            );
          })}
        </div>
      </div>
    </section>
  );
}
