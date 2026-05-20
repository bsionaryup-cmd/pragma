"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/landing/motion";

export function LandingCta() {
  return (
    <section className="border-t border-[#E9ECEF] bg-[#F7F8FA] py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <FadeIn>
          <motion.div
            whileHover={{ scale: 1.005 }}
            transition={{ duration: 0.3 }}
            className="relative overflow-hidden rounded-3xl border border-[#E9ECEF] bg-white px-8 py-16 text-center shadow-pragma-card md:px-16 md:py-20"
          >
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,#0E9F8D12,transparent_65%)]"
              aria-hidden
            />
            <div className="relative">
              <h2 className="text-3xl font-bold tracking-tight text-[#111111] md:text-4xl">
                Empieza a operar con PRAGMA hoy
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-base text-[#6B7280]">
                Únete a equipos de renta corta que centralizan reservas,
                mensajes y calendario en una plataforma premium.
              </p>
              <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
                <Button
                  size="lg"
                  className="h-12 rounded-xl bg-[#0E9F8D] px-7 text-white hover:bg-[#0B7A6E]"
                  asChild
                >
                  <Link href="/sign-up">
                    Crear cuenta gratis
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 rounded-xl border-[#111111]/15 bg-white px-7 hover:bg-[#F7F8FA]"
                  asChild
                >
                  <Link href="/sign-in">Ya tengo cuenta</Link>
                </Button>
              </div>
            </div>
          </motion.div>
        </FadeIn>
      </div>
    </section>
  );
}
