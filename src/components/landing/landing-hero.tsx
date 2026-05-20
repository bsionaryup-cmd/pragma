"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { LandingCalendarMockup } from "@/components/landing/landing-calendar-mockup";
import { APP_DESCRIPTION } from "@/lib/constants";
import { Button } from "@/components/ui/button";

const ease = [0.21, 0.47, 0.32, 0.98] as const;

export function LandingHero() {
  return (
    <section className="relative mx-auto max-w-7xl px-6 pt-20 pb-24 md:pt-28 md:pb-32">
      <div className="grid items-center gap-16 lg:grid-cols-2 lg:gap-20">
        <div>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease }}
            className="mb-6 text-xs font-semibold uppercase tracking-[0.2em] text-[#0E9F8D]"
          >
            PMS enterprise · Colombia
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.06, ease }}
            className="text-4xl font-bold leading-[1.1] tracking-tight text-[#111111] md:text-5xl lg:text-[3.25rem]"
          >
            Opera tus propiedades con claridad absoluta.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.12, ease }}
            className="mt-6 max-w-lg text-lg leading-relaxed text-[#6B7280]"
          >
            {APP_DESCRIPTION}. Reservas, bandeja de entrada, calendario e
            integraciones en un solo lugar.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.18, ease }}
            className="mt-10 flex flex-wrap items-center gap-4"
          >
            <Button
              size="lg"
              className="h-12 rounded-xl bg-[#0E9F8D] px-7 text-base font-medium text-white shadow-pragma-soft hover:bg-[#0B7A6E]"
              asChild
            >
              <Link href="/sign-up">
                Comenzar gratis
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 rounded-xl border-[#111111]/15 bg-white px-7 text-base font-medium text-[#111111] hover:bg-[#F7F8FA]"
              asChild
            >
              <Link href="/sign-in">Ver demo</Link>
            </Button>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease }}
          className="relative lg:pl-4"
        >
          <LandingCalendarMockup />
        </motion.div>
      </div>
    </section>
  );
}
