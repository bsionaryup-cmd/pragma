"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Play } from "lucide-react";
import { LandingDashboardMockup } from "@/components/landing/landing-dashboard-mockup";
import { APP_DEMO_CTA, APP_SECONDARY_CTA } from "@/lib/constants";
import { BRAND } from "@/lib/brand";
import { Button } from "@/components/ui/button";

const ease = [0.21, 0.47, 0.32, 0.98] as const;

export function LandingHero() {
  return (
    <section className="relative mx-auto max-w-7xl px-6 pt-14 pb-20 md:pt-20 md:pb-28">
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="max-w-xl lg:max-w-none">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease }}
            className="font-accent mb-6 inline-flex items-center gap-2 rounded-full border border-pragma-border bg-pragma-light-blue px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-pragma-electric"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-pragma-cyan" aria-hidden />
            Airbnb Host Command Center
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.06, ease }}
            className="font-heading text-[2rem] font-bold leading-[1.12] tracking-tight text-pragma-black sm:text-4xl lg:text-[2.75rem] lg:leading-[1.08]"
          >
            Controla tu Airbnb desde un solo lugar.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.12, ease }}
            className="mt-5 text-base leading-relaxed text-pragma-mid-gray sm:text-lg sm:leading-8"
          >
            PRAGMA centraliza reservas, automatiza tareas repetitivas y ayuda a
            anfitriones de Airbnb a operar propiedades de forma remota,
            inteligente y escalable.
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.16, ease }}
            className="mt-2 text-sm font-medium text-pragma-electric/90"
          >
            {BRAND.tagline}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.2, ease }}
            className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4"
          >
            <Button variant="brand" size="lg" className="h-11 px-6 text-[15px]" asChild>
              <Link href="/sign-up">
                {APP_DEMO_CTA}
                <ArrowRight className="h-4 w-4" strokeWidth={2} />
              </Link>
            </Button>
            <Button
              variant="brandOutline"
              size="lg"
              className="h-11 px-6 text-[15px]"
              asChild
            >
              <a href="#product">
                <Play className="h-4 w-4" strokeWidth={2} />
                {APP_SECONDARY_CTA}
              </a>
            </Button>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.22, ease }}
          className="relative lg:pl-2"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-6 rounded-[2rem] bg-pragma-gradient opacity-[0.1] blur-3xl md:-inset-8"
          />
          <LandingDashboardMockup />
        </motion.div>
      </div>
    </section>
  );
}
