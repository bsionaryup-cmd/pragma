"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/landing/motion";

export function LandingCta() {
  return (
    <section className="border-t border-white/5 py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <FadeIn>
          <motion.div
            whileHover={{ scale: 1.005 }}
            transition={{ duration: 0.3 }}
            className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900 via-zinc-900 to-violet-950/40 px-8 py-16 text-center md:px-16 md:py-20"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.15),transparent_60%)]" />
            <div className="relative">
              <h2 className="text-3xl font-semibold tracking-tight text-zinc-50 md:text-4xl">
                Empieza a operar con PRAGMA hoy
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-base text-zinc-400">
                Únete a equipos de renta corta que centralizan reservas,
                mensajes y calendario en una plataforma premium.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                <Button
                  size="lg"
                  className="h-11 bg-zinc-50 px-6 text-zinc-950 hover:bg-zinc-200"
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
                  className="h-11 border-white/10 bg-transparent text-zinc-300 hover:bg-white/5"
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
