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
    <section className="relative mx-auto max-w-7xl px-6 pt-16 pb-20 md:pt-24 md:pb-28">
      <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-16">
        <div>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease }}
            className="font-accent mb-5 inline-flex items-center gap-2 rounded-full border border-pragma-border bg-pragma-light-blue px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-pragma-electric"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-pragma-cyan" />
            Airbnb Host Command Center
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.06, ease }}
            className="font-heading text-4xl font-bold leading-[1.08] tracking-tight text-pragma-black md:text-5xl lg:text-[3.35rem]"
          >
            Controla tu Airbnb desde un solo lugar.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.12, ease }}
            className="mt-6 max-w-xl text-lg leading-relaxed text-pragma-mid-gray"
          >
            PRAGMA centraliza reservas, automatiza tareas repetitivas y ayuda a
            anfitriones de Airbnb a operar propiedades de forma remota,
            inteligente y escalable.
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.16, ease }}
            className="mt-3 text-sm text-pragma-mid-gray/90"
          >
            {BRAND.tagline}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.2, ease }}
            className="mt-10 flex flex-wrap items-center gap-4"
          >
            <Button variant="brand" size="lg" className="h-12 px-7 text-base" asChild>
              <Link href="/sign-up">
                {APP_DEMO_CTA}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="brandOutline" size="lg" className="h-12 px-7 text-base" asChild>
              <a href="#product">
                <Play className="h-4 w-4" />
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
            className="pointer-events-none absolute -inset-8 rounded-[2rem] bg-pragma-gradient opacity-[0.12] blur-3xl"
          />
          <LandingDashboardMockup />
        </motion.div>
      </div>
    </section>
  );
}
