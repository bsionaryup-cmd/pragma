"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { APP_DEMO_CTA } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/landing/motion";

export function LandingCta() {
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
                Agenda una demo y descubre cómo PRAGMA convierte tu operación
                Airbnb en un Command Center inteligente.
              </p>
              <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
                <Button variant="brand" size="lg" className="h-12 px-8" asChild>
                  <Link href="/sign-up">
                    Agenda una demo
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button variant="brandOutline" size="lg" className="h-12 px-8" asChild>
                  <Link href="/sign-in">Ya tengo cuenta</Link>
                </Button>
              </div>
              <p className="mt-6 text-xs text-pragma-mid-gray">{APP_DEMO_CTA} · Sin compromiso</p>
            </div>
          </motion.div>
        </FadeIn>
      </div>
    </section>
  );
}
