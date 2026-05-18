"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { APP_DESCRIPTION } from "@/lib/constants";
import { Button } from "@/components/ui/button";

const ease = [0.21, 0.47, 0.32, 0.98] as const;

export function LandingHero() {
  return (
    <section className="relative mx-auto max-w-6xl px-6 pt-24 pb-20 md:pt-32 md:pb-28">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
        className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-400"
      >
        <Sparkles className="h-3.5 w-3.5 text-violet-400" />
        PMS para renta corta en Colombia
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.08, ease }}
        className="max-w-3xl text-4xl font-semibold tracking-tight text-zinc-50 md:text-6xl md:leading-[1.08]"
      >
        Opera tus propiedades con{" "}
        <span className="bg-gradient-to-r from-zinc-50 via-zinc-300 to-zinc-500 bg-clip-text text-transparent">
          claridad absoluta
        </span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.16, ease }}
        className="mt-6 max-w-xl text-lg leading-relaxed text-zinc-400"
      >
        {APP_DESCRIPTION}. Reservas, mensajes y calendario en un solo lugar —
        diseñado para equipos que gestionan Airbnb y renta corta a escala.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.24, ease }}
        className="mt-10 flex flex-wrap items-center gap-4"
      >
        <Button
          size="lg"
          className="h-11 bg-zinc-50 px-6 text-zinc-950 hover:bg-zinc-200"
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
          className="h-11 border-white/10 bg-transparent text-zinc-300 hover:bg-white/5 hover:text-zinc-50"
          asChild
        >
          <Link href="/sign-in">Ver demo</Link>
        </Button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, delay: 0.35, ease }}
        className="relative mt-16 md:mt-20"
      >
        <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-white/20 to-transparent opacity-40" />
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/80 shadow-2xl shadow-black/50">
          <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-600" />
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-600" />
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-600" />
            <span className="ml-3 text-xs text-zinc-500">panel.pragma.app</span>
          </div>
          <div className="grid gap-px bg-white/5 p-6 md:grid-cols-3 md:p-8">
            {[
              { label: "Llegadas hoy", value: "12" },
              { label: "Mensajes sin leer", value: "47" },
              { label: "Ocupación", value: "84%" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-white/5 bg-zinc-950/60 p-5"
              >
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                  {stat.label}
                </p>
                <p className="mt-2 text-3xl font-semibold tabular-nums text-zinc-50">
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </section>
  );
}

