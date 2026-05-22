"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import {
  APP_PRICING_HEADLINE,
  SUBSCRIPTION_TRIAL_LABEL,
} from "@/lib/constants";
import {
  getLandingPrimaryCta,
  type LandingSession,
} from "@/lib/landing-session";
import { PLAN_CATALOG } from "@/modules/billing/domain/plan-catalog";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/landing/motion";

type LandingPricingProps = {
  session: LandingSession;
};

export function LandingPricing({ session }: LandingPricingProps) {
  const plans = Object.values(PLAN_CATALOG);
  const primary = getLandingPrimaryCta(session);

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
              {SUBSCRIPTION_TRIAL_LABEL}. Paga en línea (PSE, Nequi, tarjeta) o por transferencia
              bancaria al activar.
            </p>
          </div>
        </FadeIn>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {plans.map((plan, index) => (
            <FadeIn key={plan.code} delay={index * 0.06}>
              <motion.div
                whileHover={{ y: -4 }}
                className={`overflow-hidden rounded-3xl border bg-white shadow-pragma-card ${
                  plan.highlighted
                    ? "border-pragma-cyan ring-2 ring-pragma-cyan/20"
                    : "border-pragma-border"
                }`}
              >
                <div
                  className={`px-8 py-6 ${plan.highlighted ? "bg-pragma-light-blue/40" : "bg-pragma-soft-gray/50"}`}
                >
                  <p className="text-sm font-semibold uppercase tracking-wide text-pragma-electric">
                    {plan.name}
                  </p>
                  <p className="font-heading mt-2 text-4xl font-bold tabular-nums">
                    {plan.monthlyAmountCop.toLocaleString("es-CO")} {plan.currency}
                  </p>
                  <p className="mt-1 text-sm text-pragma-mid-gray">por mes</p>
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
                  <Button variant="brand" className="w-full" asChild>
                    <Link href={primary.href}>
                      {primary.label}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </motion.div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
